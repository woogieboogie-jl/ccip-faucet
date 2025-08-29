import { defineChain, createPublicClient, http, type Transport } from 'viem'
import { configLoader } from '../core/loader'
import type { ChainConfig, HelperChainConfig } from '../core/types'

/**
 * Config-driven Viem chain definitions and client creation
 * Consolidates chain-config.ts and viem.ts functionality
 */

// Cache for loaded chain definitions
let cachedChainConfig: ChainConfig | null = null
let cachedHelperChainConfig: HelperChainConfig | null = null



/**
 * Get the active chain configuration
 */
export async function getActiveChainConfig(): Promise<ChainConfig> {
  console.log('🔍 Getting active chain config...')
  if (!cachedChainConfig) {
    console.log('📋 Loading fresh chain config from configLoader...')
    cachedChainConfig = await configLoader.getActiveChainConfig()
    console.log('✅ Chain config loaded:', cachedChainConfig)
  } else {
    console.log('📋 Using cached chain config')
  }
  return cachedChainConfig
}

/**
 * Get the helper chain configuration
 */
export async function getHelperChainConfig(): Promise<HelperChainConfig> {
  if (!cachedHelperChainConfig) {
    cachedHelperChainConfig = await configLoader.getHelperChainConfig()
  }
  return cachedHelperChainConfig
}

/**
 * Create a Viem chain definition from configuration
 */
export function createChainFromConfig(config: ChainConfig | HelperChainConfig) {
  console.log('🔧 Creating chain from config:', {
    id: config.chainId,
    name: config.name,
    rpcUrl: config.rpcUrl
  })
  
  const chain = defineChain({
    id: config.chainId,
    name: config.name,
    network: config.name.toLowerCase().replace(/\s+/g, '-'),
    nativeCurrency: {
      name: 'ticker' in config ? config.ticker : 'Native',
      symbol: 'ticker' in config ? config.ticker : 'NATIVE',
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
      public: { http: [config.rpcUrl] },
    },
    blockExplorers: {
      default: { 
        name: `${config.name} Explorer`, 
        url: config.explorerUrl 
      },
    },
    testnet: true,
  })
  
  console.log('✅ Chain created with RPC URL:', chain.rpcUrls.default.http[0])
  return chain
}

/**
 * Get the active chain as a Viem chain definition
 */
export async function getActiveChain() {
  const config = await getActiveChainConfig()
  return createChainFromConfig(config)
}

/**
 * Get the helper chain as a Viem chain definition
 */
export async function getHelperChain() {
  const config = await getHelperChainConfig()
  return createChainFromConfig(config)
}

/**
 * Create a config-driven public client
 */
export async function createConfigDrivenPublicClient() {
  console.log('🔧 Creating config-driven public client...')
  
  const activeChain = await getActiveChain()
  console.log('⛓️ Active chain loaded:', {
    id: activeChain.id,
    name: activeChain.name,
    rpcUrl: activeChain.rpcUrls.default.http[0]
  })
  
  const client = createPublicClient({
    chain: activeChain,
    transport: http(activeChain.rpcUrls.default.http[0] as string) as Transport,
  })
  
  console.log('✅ Public client created with RPC URL:', activeChain.rpcUrls.default.http[0])
  return client
}

/**
 * Get chain constants from configuration
 */
export async function getChainConstants() {
  const chainConfig = await getActiveChainConfig()
  const helperConfig = await getHelperChainConfig()
  
  return {
    // Active chain constants
    ACTIVE_CHAIN_ID: chainConfig.chainId,
    ACTIVE_CHAIN_NAME: chainConfig.name,
    ACTIVE_CHAIN_TICKER: chainConfig.ticker,
    ACTIVE_CHAIN_EXPLORER: chainConfig.explorerUrl,
    
    // Helper chain constants
    HELPER_CHAIN_ID: helperConfig.chainId,
    HELPER_CHAIN_NAME: helperConfig.name,
    HELPER_CHAIN_EXPLORER: helperConfig.explorerUrl,
    
    // CCIP constants
    CCIP_CHAIN_SELECTORS: {
      activeChain: chainConfig.common.chainSelector,
      helperChain: helperConfig.common.chainSelector,
    },
    
    // Contract addresses
    FAUCET_ADDRESS: chainConfig.contracts.faucet,
    HELPER_ADDRESS: helperConfig.contracts.helper,
    
    // Token addresses
    ACTIVE_CHAIN_LINK_TOKEN: chainConfig.common.linkToken,
    HELPER_CHAIN_LINK_TOKEN: helperConfig.common.linkToken,
    
    // Router addresses
    ACTIVE_CHAIN_CCIP_ROUTER: chainConfig.common.ccipRouter,
    HELPER_CHAIN_CCIP_ROUTER: helperConfig.common.ccipRouter,
    
    // Account Abstraction
    AA_CONFIG: chainConfig.accountAbstraction,
  }
}

/**
 * Clear cached configurations (useful for testing and chain switching)
 */
export function clearChainConfigCache() {
  console.log('🧹 Clearing chain config cache for chain switch')
  cachedChainConfig = null
  cachedHelperChainConfig = null
} 