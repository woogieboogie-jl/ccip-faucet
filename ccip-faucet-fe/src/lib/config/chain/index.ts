/**
 * Chain Configuration Exports
 */

// Viem client exports
export * from './viem-client'

// Wagmi client exports
export * from './wagmi-client'

// Address exports
export * from './addresses'

// Re-export commonly used functions for convenience
export { 
  getActiveChain, 
  getHelperChain, 
  createConfigDrivenPublicClient,
  getChainConstants,
  getActiveChainConfig,
  getHelperChainConfig,
  clearChainConfigCache
} from './viem-client'

export { 
  getAddresses,
  clearAddressesCache
} from './addresses'

export {
  loadMinimalConfig,
  getThemeColor,
  createConfigDrivenWagmiConfig
} from './wagmi-client' 