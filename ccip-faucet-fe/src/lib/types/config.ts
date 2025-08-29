/**
 * Configuration Types for Multi-Chain Faucet
 */

export interface ChainConfig {
  chainId: number
  name: string
  ticker: string
  rpcUrl: string
  explorerUrl: string
  themeColor: string
  
  common: {
    linkToken: string
    ccipRouter: string
    chainSelector: string
  }
  
  contracts: {
    faucet: string
  }
  
  ccip: {
    helperChain: string
  }
  
  accountAbstraction: {
    networkName: string
    entryPointAddress: string
    factoryAddress: string
    bundlerUrl: string
    paymasterUrl: string
  }
}

export interface HelperChainConfig {
  chainId: number
  name: string
  rpcUrl: string
  explorerUrl: string
  themeColor: string
  
  common: {
    linkToken: string
    ccipRouter: string
    chainSelector: string
  }
  
  contracts: {
    helper: string
  }
}

export interface AppConfig {
  supportedChains: string[]
}

/**
 * Auto-derived configuration based on chain config
 */
export interface DerivedConfig {
  // Theme
  primaryColor: string
  gradientFrom: string
  gradientTo: string
  cssCustomProperties: Record<string, string>
  
  // Assets
  nativeTokenIcon: string
  linkTokenIcon: string
  
  // UI Text
  nativeSymbol: string
  nativeName: string
  pageTitle: string
  
  // Fallbacks
  fallbackIcon: string
} 