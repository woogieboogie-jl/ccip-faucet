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

// Validate environment variables dynamically based on supported chains
function validateEnv(supportedChains: string[]) {
  const required = supportedChains.map(chain => 
    `${chain.toUpperCase().replace('-', '_')}_RPC_URL`
  );
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('[ERROR] Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    console.error('\nPlease set these in your .env file or export them:');
    missing.forEach(key => console.error(`  export ${key}="your_rpc_url_here"`));
    process.exit(1);
  }
}

// Dynamic chain configuration loading from config files
interface ChainInfo {
  id: number;
  name: string;
  rpcUrl: string;
  configPath: string;
}

interface SupportedChainsConfig {
  supportedChains: string[];
}

function loadSupportedChains(): Record<string, ChainInfo> {
  try {
    // Read supported chains from config
    const chainsConfigPath = join(process.cwd(), 'ccip-faucet-fe/public/configs/chains.json');
    const chainsConfig: SupportedChainsConfig = JSON.parse(readFileSync(chainsConfigPath, 'utf-8'));
    
    const chains: Record<string, ChainInfo> = {};
    
    for (const chainName of chainsConfig.supportedChains) {
      // Load individual chain config
      const chainConfig = readConfig(chainName, getConfigPath(chainName, false));
      const rpcEnvVar = `${chainName.toUpperCase().replace('-', '_')}_RPC_URL`;
      
      chains[chainName] = {
        id: chainConfig.chainId || 0,
        name: chainConfig.name || chainName,
        rpcUrl: process.env[rpcEnvVar]!,
        configPath: getConfigPath(chainName, false)
      };
    }
    
    console.log(`✓ Loaded ${Object.keys(chains).length} supported chains: ${Object.keys(chains).join(', ')}`);
    return chains;
  } catch (error) {
    throw new Error(`Failed to load supported chains: ${error}`);
  }
}

function getConfigPath(chainName: string, isHelper: boolean): string {
  const basePath = 'ccip-faucet-fe/public/configs/chains';
  
  if (isHelper) {
    return `${basePath}/helpers/${chainName}.json`;
  } else {
    return `${basePath}/${chainName}.json`;
  }
}

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
  chainId?: number;
  name?: string;
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
  try {
    // Load supported chains dynamically
    const CHAINS = loadSupportedChains();
    
    // Validate environment for all supported chains
    validateEnv(Object.keys(CHAINS));
    
    const activeChain = process.env.CHAIN_NAME || 'monad-testnet';
    const helperChain = process.env.HELPER_NAME || 'avalanche-fuji';

    console.log('=== CCIP Pre-Flight Checks ===');
    console.log(`Active Chain: ${activeChain}`);
    console.log(`Helper Chain: ${helperChain}`);
    
    // Detect same-chain deployment
    const isSameChain = activeChain === helperChain;
    if (isSameChain) {
      console.log('🔗 Same-chain deployment detected - using direct volatility feeds');
    } else {
      console.log('🌐 Cross-chain deployment detected - using CCIP communication');
    }
    console.log('');
    
    // Validate that requested chains are supported
    if (!CHAINS[activeChain]) {
      throw new Error(`Active chain '${activeChain}' not found in supported chains: ${Object.keys(CHAINS).join(', ')}`);
    }
    if (!CHAINS[helperChain]) {
      throw new Error(`Helper chain '${helperChain}' not found in supported chains: ${Object.keys(CHAINS).join(', ')}`);
    }
    
    // Debug: Show RPC URLs (first 20 chars for security)
    console.log('=== RPC URLs ===');
    console.log(`${CHAINS[activeChain].name} RPC: ${CHAINS[activeChain].rpcUrl?.substring(0, 20)}...`);
    console.log(`${CHAINS[helperChain].name} RPC: ${CHAINS[helperChain].rpcUrl?.substring(0, 20)}...`);
    console.log('');

    // Read configurations using dynamic paths
    const activeConfig = readConfig(activeChain, CHAINS[activeChain].configPath);
    
    // Always read helper config from helpers/ folder (even for same-chain)
    // This ensures we get the helper contract address
    const helperConfig = readConfig(helperChain, getConfigPath(helperChain, true)); // Helper configs are in helpers/ folder

    // Create clients using dynamic RPC URLs
    const activeClient = createPublicClient({
      transport: http(CHAINS[activeChain].rpcUrl)
    });

    // For same-chain deployment, use the same client; for cross-chain, create separate client
    const helperClient = isSameChain 
      ? activeClient  // Same chain - use same client (optimization)
      : createPublicClient({
          transport: http(CHAINS[helperChain].rpcUrl)
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

    // Check cross-chain mappings (skip for same-chain deployments)
    let mappingsOk = true;
    if (isSameChain) {
      console.log('=== 2. Same-Chain Configuration ===');
      console.log('[INFO] Same-chain deployment - skipping cross-chain mapping checks');
      console.log('[INFO] Faucet will use direct volatility feed access instead of CCIP');
      console.log('');
    } else {
      console.log('=== 2. Cross-Chain Mappings ===');
      mappingsOk = await checkMappings(
        activeClient, 
        helperClient, 
        activeConfig, 
        helperConfig
      );
    }

    // Check LINK balances in vaults (still needed for same-chain, but different requirements)
    console.log('=== 3. LINK Token Balances (Vaults) ===');
    const linkOk = await checkLinkBalances(
      activeClient,
      helperClient,
      activeConfig,
      helperConfig,
      isSameChain
    );

    // Check volatility feed
    console.log('=== 4. Volatility Feed ===');
    const feedOk = await checkVolatilityFeed(helperClient, helperConfig);

    // Check faucet state (tanks = distribution allocation, vaults = available balance)
    console.log('=== 5. Faucet State (Tanks) ===');
    const { stateOk, needsRefill } = await checkFaucetState(activeClient, activeConfig.contracts.faucet!);

    // Check owners
    console.log('=== 6. Owner Verification ===');
    await checkOwners(activeClient, helperClient, activeConfig, helperConfig);

    // Summary
    console.log('=== Summary ===');
    const allChecksPass = mappingsOk && linkOk && feedOk && stateOk;
    
    if (allChecksPass) {
      if (isSameChain) {
        console.log('[READY] Same-chain deployment ready! All checks passed.');
        console.log('[INFO] Faucet will use direct volatility feed access (no CCIP required)');
      } else {
        console.log('[READY] Cross-chain CCIP ready! All checks passed.');
      }
      const rpcEnvVar = `${activeChain.toUpperCase().replace('-', '_')}_RPC_URL`;
      
      if (needsRefill) {
        console.log(`[ACTION] Tanks need refill - Run: cast send ${activeConfig.contracts.faucet} "triggerRefillCheck()" --private-key $FAUCET_PRIVATE_KEY --rpc-url $${rpcEnvVar}`);
      } else {
        console.log(`[INFO] Tanks are full - Faucet ready for user operations`);
        console.log(`[OPTIONAL] To test refill: cast send ${activeConfig.contracts.faucet} "triggerRefillCheck()" --private-key $FAUCET_PRIVATE_KEY --rpc-url $${rpcEnvVar}`);
      }
    } else {
      if (isSameChain) {
        console.log('[NOT READY] Fix issues above before triggering same-chain refill.');
      } else {
        console.log('[NOT READY] Fix issues above before triggering CCIP.');
      }
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
  helperConfig: Config,
  isSameChain: boolean = false
): Promise<boolean> {
  try {
    // Check faucet LINK vault balance (available for CCIP fees)
    const activeLinkContract = getContract({
      address: activeConfig.common.linkToken as `0x${string}`,
      abi: ERC20_ABI,
      client: activeClient
    });

    const faucetBalance = await activeLinkContract.read.balanceOf([activeConfig.contracts.faucet!]);
    console.log(`Faucet LINK vault balance: ${formatEther(faucetBalance)} LINK`);

    let helperBalance = BigInt(0);
    
    if (isSameChain) {
      console.log('[INFO] Same-chain deployment - helper contract may not need LINK for direct feeds');
      // For same-chain, we still check helper balance but it's less critical
      const helperLinkContract = getContract({
        address: helperConfig.common.linkToken as `0x${string}`,
        abi: ERC20_ABI,
        client: helperClient
      });
      helperBalance = await helperLinkContract.read.balanceOf([helperConfig.contracts.helper!]);
      console.log(`Helper LINK vault balance: ${formatEther(helperBalance)} LINK (not required for same-chain)`);
    } else {
      // Check helper LINK balance for cross-chain
      const helperLinkContract = getContract({
        address: helperConfig.common.linkToken as `0x${string}`,
        abi: ERC20_ABI,
        client: helperClient
      });
      helperBalance = await helperLinkContract.read.balanceOf([helperConfig.contracts.helper!]);
      console.log(`Helper LINK vault balance: ${formatEther(helperBalance)} LINK`);
    }

    const faucetOk = faucetBalance >= BigInt('1000000000000000000'); // 1 LINK
    const helperOk = isSameChain ? true : helperBalance >= BigInt('1000000000000000000'); // 1 LINK (not required for same-chain)

    if (faucetOk) {
      console.log('[OK] Faucet vault has sufficient LINK (>=1)');
    } else {
      console.log('[ERROR] Faucet vault needs more LINK for outbound fees');
    }

    if (isSameChain) {
      console.log('[OK] Helper vault LINK balance not required for same-chain deployment');
    } else {
      if (helperOk) {
        console.log('[OK] Helper vault has sufficient LINK (>=1)');
      } else {
        console.log('[ERROR] Helper vault needs more LINK for reply fees');
      }
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

// Safe contract read with retry logic for different block tags
async function safeContractRead(contract: any, functionName: string, args: any[] = []): Promise<any> {
  const blockTags = ['latest', 'pending', 'safe'];
  
  for (const blockTag of blockTags) {
    try {
      if (args.length > 0) {
        return await contract.read[functionName](args, { blockTag });
      } else {
        return await contract.read[functionName]({ blockTag });
      }
    } catch (error) {
      // Continue to next block tag
    }
  }
  
  // If all block tags fail, try without specifying block tag
  try {
    if (args.length > 0) {
      return await contract.read[functionName](args);
    } else {
      return await contract.read[functionName]();
    }
  } catch (error) {
    throw error;
  }
}

async function checkFaucetState(client: any, faucetAddress: string): Promise<boolean> {
  try {
    const faucetContract = getContract({
      address: faucetAddress as `0x${string}`,
      abi: FAUCET_ABI,
      client
    });

    // Check tank status with retry logic (tanks = allocated for distribution)
    const [nativeTank, nativeDripRate, linkTank, linkDripRate] = await safeContractRead(faucetContract, 'getReservoirStatus');
    console.log(`Native Tank: ${formatEther(nativeTank)} tokens (allocated for distribution)`);
    console.log(`LINK Tank: ${formatEther(linkTank)} LINK (allocated for distribution)`);

    // Check refill status with retry logic
    const refillInProgress = await safeContractRead(faucetContract, 'refillInProgress');
    console.log(`Refill in progress: ${refillInProgress}`);

    if (refillInProgress) {
      console.log('[ERROR] Cannot trigger: refill already in progress');
      console.log('');
      return false;
    } else {
      console.log('[OK] No active refill');
    }

    // Check if refill is needed with retry logic (refill transfers from vault to tank)
    const thresholdFactor = await safeContractRead(faucetContract, 'thresholdFactor');
    const nativeThreshold = nativeDripRate * thresholdFactor;
    const linkThreshold = linkDripRate * thresholdFactor;

    const needsRefill = nativeTank < nativeThreshold || linkTank < linkThreshold;

    if (needsRefill) {
      console.log('[OK] Refill needed (tanks below threshold)');
    } else {
      console.log('[OK] Tanks sufficiently filled (above threshold)');
      console.log('[INFO] Faucet ready for user operations');
    }

    console.log('');
    return { stateOk: true, needsRefill }; // Both scenarios (needs refill OR tanks full) are OK states
  } catch (error) {
    console.log(`[ERROR] Faucet state check failed: ${error}`);
    console.log('[INFO] This may be due to RPC limitations on historical state');
    console.log('');
    return { stateOk: false, needsRefill: false };
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

    // Use safe contract read for owner checks
    const faucetOwner = await safeContractRead(faucetContract, 'owner');
    const helperOwner = await safeContractRead(helperContract, 'owner');

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
    console.log('[INFO] This may be due to RPC limitations on historical state');
    console.log('');
  }
}

main().catch(console.error);
