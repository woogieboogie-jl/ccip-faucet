import { createConfig, http } from 'wagmi'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { configLoader } from '../core/loader'
import { getActiveChain } from './viem-client'

/**
 * Wagmi-specific configuration loader
 * Handles Wagmi client creation and theme color loading
 */

// WalletConnect project ID (obtain one at https://cloud.walletconnect.com)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo'

// Create a function to get config-driven chains
export async function getConfigDrivenChains() {
  try {
    console.log('🔗 Loading all supported chains for Wagmi...')
    
    // Load all supported chains from chains.json
    const chainsConfig = await configLoader.loadChainsConfig()
    const supportedChainNames = chainsConfig.supportedChains || []
    
    console.log('📋 Supported chains:', supportedChainNames)
    
    const chains = []
    for (const chainName of supportedChainNames) {
      try {
        const chainConfig = await configLoader.loadChainConfig(chainName)
        
        // Create Wagmi-compatible chain definition
        const wagmiChain = {
          id: chainConfig.chainId,
          name: chainConfig.name,
          network: chainName,
          nativeCurrency: { 
            name: chainConfig.ticker || chainConfig.name, 
            symbol: chainConfig.ticker || 'ETH', 
            decimals: 18 
          },
          rpcUrls: { 
            default: { http: [chainConfig.rpcUrl] }, 
            public: { http: [chainConfig.rpcUrl] } 
          },
          blockExplorers: { 
            default: { 
              name: `${chainConfig.name} Explorer`, 
              url: chainConfig.explorerUrl 
            } 
          },
          testnet: true, // All our chains are testnets for now
        }
        
        chains.push(wagmiChain)
        console.log(`✅ Loaded chain: ${chainConfig.name} (${chainConfig.chainId})`)
      } catch (error) {
        console.warn(`⚠️ Failed to load chain config for ${chainName}:`, error)
      }
    }
    
    console.log(`🎉 Successfully loaded ${chains.length} chains for Wagmi`)
    return chains
  } catch (error) {
    console.error('❌ Failed to load supported chains, falling back to active chain only:', error)
    
    // Fallback: just return active chain
    const activeChain = await getActiveChain()
    return [activeChain]
  }
}

// Create a function to get config-driven wagmi config
export async function createConfigDrivenWagmiConfig() {
  const chains = await getConfigDrivenChains()
  
  return createConfig({
    chains,
    connectors: [
      injected(),
      coinbaseWallet({
        appName: 'Monad CCIP Faucet',
        appLogoUrl: 'https://via.placeholder.com/128',
      }),
      walletConnect({ projectId }),
    ],
    transports: Object.fromEntries(
      chains.map((c) => [c.id, http()])
    ),
  })
}

// Load minimal config from chain-config.json to avoid hardcoding
export async function loadMinimalConfig() {
  try {
    const response = await fetch('/configs/chain-config.json')
    if (response.ok) {
      const config = await response.json()
      const minimalConfig = config.minimal
      
      if (minimalConfig) {
        return createConfig({
          chains: minimalConfig.chains || [{
            id: 1,
            name: 'Loading...',
            network: 'loading',
            nativeCurrency: { name: 'Loading', symbol: 'LOAD', decimals: 18 },
            rpcUrls: { default: { http: ['https://placeholder.com'] }, public: { http: ['https://placeholder.com'] } },
            blockExplorers: { default: { name: 'Loading', url: 'https://placeholder.com' } },
          }],
          connectors: minimalConfig.connectors || [],
          transports: minimalConfig.transports ? 
            Object.fromEntries(Object.entries(minimalConfig.transports).map(([id, type]) => [id, http()])) : 
            { 1: http() },
        })
      }
    }
  } catch (error) {
    console.warn('Failed to load minimal config from chain-config.json, using fallback:', error)
  }
  
  // Fallback minimal config if file doesn't exist or is invalid
  return createConfig({
    chains: [{
      id: 1,
      name: 'Loading...',
      network: 'loading',
      nativeCurrency: { name: 'Loading', symbol: 'LOAD', decimals: 18 },
      rpcUrls: { default: { http: ['https://placeholder.com'] }, public: { http: ['https://placeholder.com'] } },
      blockExplorers: { default: { name: 'Loading', url: 'https://placeholder.com' } },
    }],
    connectors: [],
    transports: { 1: http() },
  })
}

// Get theme color from active chain config
export async function getThemeColor(): Promise<string> {
  try {
    const activeChain = await configLoader.getActiveChainConfig()
    return activeChain.themeColor || '#8A5CF6' // fallback to purple
  } catch (error) {
    console.warn('Failed to load theme color from config, using fallback:', error)
    return '#8A5CF6' // fallback to purple
  }
} 