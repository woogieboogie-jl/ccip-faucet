/**
 * UI Configuration Exports
 */

// Constants exports
export * from './constants'

// Theme exports
export * from './theme'

// Re-export commonly used functions for convenience
export { 
  getConstants, 
  getExplorerRegistry, 
  getConfigExplorerUrl
} from './constants'

export { 
  themeManager
} from './theme' 