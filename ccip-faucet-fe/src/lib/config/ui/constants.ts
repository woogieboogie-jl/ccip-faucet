import { getChainConstants } from '../chain/viem-client'

// Vault thresholds
export const VAULT_THRESHOLDS = {
  mon: { critical: 5000, warning: 10000 },
  link: { critical: 1000, warning: 2000 },
} as const

// Tank thresholds (percentage of max capacity)
export const TANK_THRESHOLD_PERCENTAGE = 0.3

// Copy feedback duration
export const COPY_FEEDBACK_DURATION = 2000 // 2 seconds

// Animation durations
export const ANIMATION_DURATIONS = {
  drip: 800,
  button: 200,
  tooltip: 150,
} as const

// API endpoints
export const API_ENDPOINTS = {
  volatility: "/api/volatility",
  ccip: "/api/ccip",
} as const

// Default values
export const DEFAULTS = {
  volatility: {
    multiplier: 1.0,
    updateInterval: 30 * 60 * 1000, // 30 minutes
  },
  ui: {
    addressTruncation: { start: 6, end: 4 },
    numberFormatting: { decimals: 2 },
  },
} as const

// Validation rules
export const VALIDATION = {
  address: /^0x[a-fA-F0-9]{40}$/,
  amount: {
    min: 0.000001,
    max: 1000000,
  },
} as const 

// CONFIG-DRIVEN CONSTANTS
// These are loaded from configuration files
let chainConstants: Awaited<ReturnType<typeof getChainConstants>> | null = null

/**
 * Get chain constants from configuration
 * This replaces all hardcoded chain values
 */
export async function getConstants() {
  if (!chainConstants) {
    chainConstants = await getChainConstants()
  }
  return chainConstants
}

/**
 * Initialize constants cache
 * Call this early in your app initialization
 */
export async function initializeConstants() {
  await getConstants()
  console.log('✅ Chain constants initialized from configuration')
}

// Universal Explorer Registry - Now fully config-driven
export const EXPLORER_REGISTRY = {
  // CONFIGURABLE: These will be populated from config
  // Generic fallbacks - will be overridden by config system
  monad: {
    name: "Active Chain Explorer",
    baseUrl: "https://placeholder.com",
    address: (address: string) => `https://placeholder.com/address/${address}`,
    contract: (address: string) => `https://placeholder.com/address/${address}?tab=Contract`,
    tx: (hash: string) => `https://placeholder.com/tx/${hash}`,
    block: (block: string) => `https://placeholder.com/block/${block}`,
  },
  
  // CONFIGURABLE: Helper chain explorer will be loaded from config
  // Generic fallback - will be overridden by config system
  helper: {
    name: "Helper Chain Explorer",
    baseUrl: "https://placeholder.com",
    address: (address: string) => `https://placeholder.com/address/${address}`,
    contract: (address: string) => `https://placeholder.com/address/${address}?tab=Contract`,
    tx: (hash: string) => `https://placeholder.com/tx/${hash}`,
    block: (block: string) => `https://placeholder.com/block/${block}`,
  },
  
  ccip: {
    name: "CCIP Explorer",
    baseUrl: "https://ccip.chain.link",
    message: (messageId: string) => `https://ccip.chain.link/msg/${messageId}`,
  },
} as const

/**
 * Get config-driven explorer registry
 */
export async function getExplorerRegistry() {
  const constants = await getConstants()
  
  return {
    active: {
      name: `${constants.ACTIVE_CHAIN_NAME} Explorer`,
      baseUrl: constants.ACTIVE_CHAIN_EXPLORER,
      address: (address: string) => `${constants.ACTIVE_CHAIN_EXPLORER}/address/${address}`,
      contract: (address: string) => `${constants.ACTIVE_CHAIN_EXPLORER}/address/${address}?tab=Contract`,
      tx: (hash: string) => `${constants.ACTIVE_CHAIN_EXPLORER}/tx/${hash}`,
      block: (block: string) => `${constants.ACTIVE_CHAIN_EXPLORER}/block/${block}`,
    },
    
    helper: {
      name: `${constants.HELPER_CHAIN_NAME} Explorer`,
      baseUrl: constants.HELPER_CHAIN_EXPLORER,
      address: (address: string) => `${constants.HELPER_CHAIN_EXPLORER}/address/${address}`,
      contract: (address: string) => `${constants.HELPER_CHAIN_EXPLORER}/address/${address}?tab=Contract`,
      tx: (hash: string) => `${constants.HELPER_CHAIN_EXPLORER}/tx/${hash}`,
      block: (block: string) => `${constants.HELPER_CHAIN_EXPLORER}/block/${block}`,
    },
    
    ccip: {
      name: "CCIP Explorer",
      baseUrl: "https://ccip.chain.link",
      message: (messageId: string) => `https://ccip.chain.link/msg/${messageId}`,
    },
  }
}

// Legacy explorer URLs for backward compatibility
export const EXPLORER_URLS = {
  ethereum: "https://etherscan.io",
  sepolia: "https://sepolia.etherscan.io",
  monad: EXPLORER_REGISTRY.monad.baseUrl,
  // NOTE: Helper chain URL will be loaded from config
} as const

// Helper functions for explorer links
export const getExplorerUrl = (chain: 'monad' | 'helper', type: 'address' | 'contract' | 'tx' | 'block', value: string): string => {
  const explorer = EXPLORER_REGISTRY[chain]
  if (!explorer) return '#'
  
  switch (type) {
    case 'address':
      return explorer.address(value)
    case 'contract':
      return explorer.contract(value)
    case 'tx':
      return explorer.tx(value)
    case 'block':
      return explorer.block(value)
    default:
      return explorer.baseUrl
  }
}

/**
 * Config-driven explorer URL helper
 */
export async function getConfigExplorerUrl(
  chain: 'active' | 'helper', 
  type: 'address' | 'contract' | 'tx' | 'block', 
  value: string
): Promise<string> {
  const registry = await getExplorerRegistry()
  const explorer = registry[chain]
  
  switch (type) {
    case 'address':
      return explorer.address(value)
    case 'contract':
      return explorer.contract(value)
    case 'tx':
      return explorer.tx(value)
    case 'block':
      return explorer.block(value)
    default:
      return explorer.baseUrl
  }
}

// BACKWARD COMPATIBILITY FUNCTION
// @deprecated Use getExplorerRegistry().ccip.message() instead
export const getCCIPExplorerUrl = (messageId: string): string => {
  return EXPLORER_REGISTRY.ccip.message(messageId)
} 