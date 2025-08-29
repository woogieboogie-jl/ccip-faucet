/**
 * Main Configuration Interface
 * Unified exports for all configuration functionality
 */

// Core exports
export * from './core'

// Chain exports
export * from './chain'

// UI exports
export * from './ui'

// Unified service
export * from './service'

// Re-export commonly used functions for convenience
export { 
  configLoader
} from './core'

export { 
  getActiveChain,
  getHelperChain,
  createConfigDrivenPublicClient,
  getChainConstants,
  getAddresses,
  getActiveChainConfig,
  getHelperChainConfig
} from './chain'

export { 
  getConstants,
  getExplorerRegistry,
  getConfigExplorerUrl,
  themeManager
} from './ui'

export { 
  configService
} from './service' 