#!/usr/bin/env tsx

import { createPublicClient, http, getContract, formatEther, parseAbi } from 'viem';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load .env file if it exists
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('✓ Loaded .env file');
} else {
  console.log('ℹ No .env file found, using system environment variables');
}

// Validate environment variables
function validateEnv() {
  const required = ['MONAD_TESTNET_RPC_URL', 'AVALANCHE_FUJI_RPC_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('[ERROR] Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    console.error('\nPlease set these in your .env file or export them:');
    missing.forEach(key => console.error(`  export ${key}="your_rpc_url_here"`));
    process.exit(1);
  }
}

// Chain configurations
const CHAINS = {
  'monad-testnet': {
    id: 10143,
    name: 'Monad Testnet',
    rpcUrl: process.env.MONAD_TESTNET_RPC_URL!,
    configPath: 'ccip-faucet-fe/public/configs/chains/monad-testnet.json'
  },
  'avalanche-fuji': {
    id: 43113,
    name: 'Avalanche Fuji',
    rpcUrl: process.env.AVALANCHE_FUJI_RPC_URL!,
    configPath: 'ccip-faucet-fe/public/configs/chains/helpers/avalanche-fuji.json'
  }
};

// Contract ABIs (minimal)
const FAUCET_ABI = parseAbi([
  'function trustedSenders(uint64) external view returns (address)',
  'function getReservoirStatus() external view returns (uint256, uint256, uint256, uint256)',
  'function refillInProgress() external view returns (bool)',
  'function thresholdFactor() external view returns (uint256)',
  'function owner() external view returns (address)'
]);

const HELPER_ABI = parseAbi([
  'function selectorToFaucet(uint64) external view returns (address)',
  'function owner() external view returns (address)',
  'function volatilityFeed() external view returns (address)'
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address) external view returns (uint256)'
]);

const VOLATILITY_FEED_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function description() external view returns (string)'
]);

interface Config {
  common: {
    chainSelector: string;
    linkToken: string;
    ccipRouter: string;
  };
  contracts: {
    faucet?: string;
    helper?: string;
    volatilityFeed?: string;
  };
}

async function main() {
  // Validate environment first
  validateEnv();
  
  const activeChain = process.env.CHAIN_NAME || 'monad-testnet';
  const helperChain = process.env.HELPER_NAME || 'avalanche-fuji';

  console.log('=== CCIP Pre-Flight Checks ===');
  console.log(`Active Chain: ${activeChain}`);
  console.log(`Helper Chain: ${helperChain}`);
  console.log('');
  
  // Debug: Show RPC URLs (first 20 chars for security)
  console.log('=== RPC URLs ===');
  console.log(`Monad RPC: ${process.env.MONAD_TESTNET_RPC_URL?.substring(0, 20)}...`);
  console.log(`Fuji RPC: ${process.env.AVALANCHE_FUJI_RPC_URL?.substring(0, 20)}...`);
  console.log('');

  try {
    // Read configurations
    const activeConfig = readConfig(activeChain, CHAINS[activeChain as keyof typeof CHAINS].configPath);
    const helperConfig = readConfig(helperChain, CHAINS[helperChain as keyof typeof CHAINS].configPath);

    // Create clients
    const activeClient = createPublicClient({
      transport: http(CHAINS[activeChain as keyof typeof CHAINS].rpcUrl)
    });

    const helperClient = createPublicClient({
      transport: http(CHAINS[helperChain as keyof typeof CHAINS].rpcUrl)
    });

    console.log('=== 1. Contract Addresses ===');
    console.log(`Faucet Address: ${activeConfig.contracts.faucet}`);
    console.log(`Helper Address: ${helperConfig.contracts.helper}`);
    console.log(`Active Selector: ${activeConfig.common.chainSelector}`);
    console.log(`Helper Selector: ${helperConfig.common.chainSelector}`);
    console.log('');

    // Check contract deployments
    const faucetDeployed = await checkContractDeployed(activeClient, activeConfig.contracts.faucet!, 'Faucet');
    const helperDeployed = await checkContractDeployed(helperClient, helperConfig.contracts.helper!, 'Helper');

    if (!faucetDeployed || !helperDeployed) {
      console.log('[NOT READY] Contracts not deployed properly');
      process.exit(1);
    }

    // Check cross-chain mappings
    console.log('=== 2. Cross-Chain Mappings ===');
    const mappingsOk = await checkMappings(
      activeClient, 
      helperClient, 
      activeConfig, 
      helperConfig
    );

    // Check LINK balances
    console.log('=== 3. LINK Token Balances ===');
    const linkOk = await checkLinkBalances(
      activeClient,
      helperClient,
      activeConfig,
      helperConfig
    );

    // Check volatility feed
    console.log('=== 4. Volatility Feed ===');
    const feedOk = await checkVolatilityFeed(helperClient, helperConfig);

    // Check faucet state
    console.log('=== 5. Faucet State ===');
    const stateOk = await checkFaucetState(activeClient, activeConfig.contracts.faucet!);

    // Check owners
    console.log('=== 6. Owner Verification ===');
    await checkOwners(activeClient, helperClient, activeConfig, helperConfig);

    // Summary
    console.log('=== Summary ===');
    const allChecksPass = mappingsOk && linkOk && feedOk && stateOk;
    
    if (allChecksPass) {
      console.log('[READY] CCIP ready! All checks passed.');
      console.log(`Run: cast send ${activeConfig.contracts.faucet} "triggerRefillCheck()" --private-key $FAUCET_PRIVATE_KEY --rpc-url $${activeChain.toUpperCase().replace('-', '_')}_RPC_URL`);
    } else {
      console.log('[NOT READY] Fix issues above before triggering CCIP.');
    }

  } catch (error) {
    console.error('Error during pre-flight checks:', error);
    process.exit(1);
  }
}

function readConfig(chainName: string, configPath: string): Config {
  try {
    const fullPath = join(process.cwd(), configPath);
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read config for ${chainName}: ${error}`);
  }
}

async function checkContractDeployed(client: any, address: string, name: string): Promise<boolean> {
  try {
    const code = await client.getBytecode({ address: address as `0x${string}` });
    if (code && code !== '0x') {
      console.log(`[OK] ${name} contract deployed`);
      return true;
    } else {
      console.log(`[ERROR] ${name} contract not found at ${address}`);
      return false;
    }
  } catch (error) {
    console.log(`[ERROR] ${name} contract check failed: ${error}`);
    return false;
  }
}

async function checkMappings(
  activeClient: any,
  helperClient: any,
  activeConfig: Config,
  helperConfig: Config
): Promise<boolean> {
  try {
    // Check faucet → helper mapping
    const faucetContract = getContract({
      address: activeConfig.contracts.faucet! as `0x${string}`,
      abi: FAUCET_ABI,
      client: activeClient
    });

    const trustedHelper = await faucetContract.read.trustedSenders([BigInt(helperConfig.common.chainSelector)]);
    console.log(`Faucet trustedSenders[${helperConfig.common.chainSelector}] = ${trustedHelper}`);
    
    const faucetOk = trustedHelper.toLowerCase() === helperConfig.contracts.helper!.toLowerCase();
    if (faucetOk) {
      console.log('[OK] Faucet correctly trusts helper');
    } else {
      console.log(`[ERROR] Faucet mapping incorrect. Expected: ${helperConfig.contracts.helper}, Got: ${trustedHelper}`);
    }

    // Check helper → faucet mapping
    const helperContract = getContract({
      address: helperConfig.contracts.helper! as `0x${string}`,
      abi: HELPER_ABI,
      client: helperClient
    });

    const trustedFaucet = await helperContract.read.selectorToFaucet([BigInt(activeConfig.common.chainSelector)]);
    console.log(`Helper selectorToFaucet[${activeConfig.common.chainSelector}] = ${trustedFaucet}`);
    
    const helperOk = trustedFaucet.toLowerCase() === activeConfig.contracts.faucet!.toLowerCase();
    if (helperOk) {
      console.log('[OK] Helper correctly trusts faucet');
    } else {
      console.log(`[ERROR] Helper mapping incorrect. Expected: ${activeConfig.contracts.faucet}, Got: ${trustedFaucet}`);
    }

    console.log('');
    return faucetOk && helperOk;
  } catch (error) {
    console.log(`[ERROR] Mapping check failed: ${error}`);
    console.log('');
    return false;
  }
}

async function checkLinkBalances(
  activeClient: any,
  helperClient: any,
  activeConfig: Config,
  helperConfig: Config
): Promise<boolean> {
  try {
    // Check faucet LINK balance
    const activeLinkContract = getContract({
      address: activeConfig.common.linkToken as `0x${string}`,
      abi: ERC20_ABI,
      client: activeClient
    });

    const faucetBalance = await activeLinkContract.read.balanceOf([activeConfig.contracts.faucet!]);
    console.log(`Faucet LINK balance: ${formatEther(faucetBalance)} LINK`);

    // Check helper LINK balance
    const helperLinkContract = getContract({
      address: helperConfig.common.linkToken as `0x${string}`,
      abi: ERC20_ABI,
      client: helperClient
    });

    const helperBalance = await helperLinkContract.read.balanceOf([helperConfig.contracts.helper!]);
    console.log(`Helper LINK balance: ${formatEther(helperBalance)} LINK`);

    const faucetOk = faucetBalance >= BigInt('1000000000000000000'); // 1 LINK
    const helperOk = helperBalance >= BigInt('1000000000000000000'); // 1 LINK

    if (faucetOk) {
      console.log('[OK] Faucet has sufficient LINK (>=1)');
    } else {
      console.log('[ERROR] Faucet needs more LINK for outbound fees');
    }

    if (helperOk) {
      console.log('[OK] Helper has sufficient LINK (>=1)');
    } else {
      console.log('[ERROR] Helper needs more LINK for reply fees');
    }

    console.log('');
    return faucetOk && helperOk;
  } catch (error) {
    console.log(`[ERROR] LINK balance check failed: ${error}`);
    console.log('');
    return false;
  }
}

async function checkVolatilityFeed(
  helperClient: any,
  helperConfig: Config
): Promise<boolean> {
  try {
    // Get volatility feed address from helper contract
    const helperContract = getContract({
      address: helperConfig.contracts.helper! as `0x${string}`,
      abi: HELPER_ABI,
      client: helperClient
    });

    const feedAddress = await helperContract.read.volatilityFeed();
    console.log(`Volatility Feed Address: ${feedAddress}`);

    // Test the feed
    const feedContract = getContract({
      address: feedAddress as `0x${string}`,
      abi: VOLATILITY_FEED_ABI,
      client: helperClient
    });

    // Get feed description
    let description = 'Unknown Feed';
    try {
      description = await feedContract.read.description();
    } catch (e) {
      // Some feeds might not have description, that's ok
    }

    // Test latestRoundData
    const [roundId, answer, startedAt, updatedAt, answeredInRound] = await feedContract.read.latestRoundData();
    
    console.log(`Feed Description: ${description}`);
    console.log(`Latest Price: ${answer} (raw value)`);
    console.log(`Last Updated: ${new Date(Number(updatedAt) * 1000).toISOString()}`);
    
    // Check if data is recent (within 24 hours)
    const now = Math.floor(Date.now() / 1000);
    const isRecent = (now - Number(updatedAt)) < 86400; // 24 hours
    
    // Check if answer is reasonable (not zero)
    const hasValidAnswer = answer !== BigInt(0);
    
    if (hasValidAnswer && isRecent) {
      console.log('[OK] Volatility feed is working and data is recent');
    } else if (!hasValidAnswer) {
      console.log('[ERROR] Volatility feed returned zero/invalid price');
    } else if (!isRecent) {
      console.log('[WARN] Volatility feed data is stale (>24h old)');
      console.log('[OK] Feed is functional but data may be outdated');
    }

    console.log('');
    return hasValidAnswer;
  } catch (error) {
    console.log(`[ERROR] Volatility feed check failed: ${error}`);
    console.log('[ERROR] This will cause CCIP message execution to revert!');
    console.log('');
    return false;
  }
}

async function checkFaucetState(client: any, faucetAddress: string): Promise<boolean> {
  try {
    const faucetContract = getContract({
      address: faucetAddress as `0x${string}`,
      abi: FAUCET_ABI,
      client
    });

    // Check reservoir status
    const [nativePool, nativeDripRate, linkPool, linkDripRate] = await faucetContract.read.getReservoirStatus();
    console.log(`Native Pool: ${formatEther(nativePool)} tokens`);
    console.log(`LINK Pool: ${formatEther(linkPool)} LINK`);

    // Check refill status
    const refillInProgress = await faucetContract.read.refillInProgress();
    console.log(`Refill in progress: ${refillInProgress}`);

    if (refillInProgress) {
      console.log('[ERROR] Cannot trigger: refill already in progress');
      console.log('');
      return false;
    } else {
      console.log('[OK] No active refill');
    }

    // Check if refill is needed
    const thresholdFactor = await faucetContract.read.thresholdFactor();
    const nativeThreshold = nativeDripRate * thresholdFactor;
    const linkThreshold = linkDripRate * thresholdFactor;

    const needsRefill = nativePool < nativeThreshold || linkPool < linkThreshold;

    if (needsRefill) {
      console.log('[OK] Refill needed');
    } else {
      console.log('[WARN] Reservoirs full - may need to increase thresholdFactor');
      console.log(`[TIP] Run: cast send ${faucetAddress} "setThresholdFactor(uint256)" 20 --private-key $FAUCET_PRIVATE_KEY --rpc-url $RPC_URL`);
    }

    console.log('');
    return needsRefill;
  } catch (error) {
    console.log(`[ERROR] Faucet state check failed: ${error}`);
    console.log('');
    return false;
  }
}

async function checkOwners(
  activeClient: any,
  helperClient: any,
  activeConfig: Config,
  helperConfig: Config
): Promise<void> {
  try {
    const faucetContract = getContract({
      address: activeConfig.contracts.faucet! as `0x${string}`,
      abi: FAUCET_ABI,
      client: activeClient
    });

    const helperContract = getContract({
      address: helperConfig.contracts.helper! as `0x${string}`,
      abi: HELPER_ABI,
      client: helperClient
    });

    const faucetOwner = await faucetContract.read.owner();
    const helperOwner = await helperContract.read.owner();

    console.log(`Faucet owner: ${faucetOwner}`);
    console.log(`Helper owner: ${helperOwner}`);

    if (faucetOwner.toLowerCase() === helperOwner.toLowerCase()) {
      console.log('[OK] Same owner for both contracts');
    } else {
      console.log('[WARN] Different owners - ensure coordination');
    }

    console.log('');
  } catch (error) {
    console.log(`[ERROR] Owner check failed: ${error}`);
    console.log('');
  }
}

main().catch(console.error);
