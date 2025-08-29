import { createConfig, http } from 'wagmi'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { mainnet, sepolia, polygon, optimism, arbitrum, base } from 'wagmi/chains'
import { getConfigDrivenChains } from './config/chain/wagmi-client'

// WalletConnect project ID (obtain one at https://cloud.walletconnect.com)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo'

// Use config-driven chains instead of hardcoded ones
let chains: any[] = []
let config: any = null

// Initialize config asynchronously
async function initializeConfig() {
  try {
    chains = await getConfigDrivenChains()
    
    config = createConfig({
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
    
    return config
  } catch (error) {
    console.error('Failed to initialize config-driven wagmi config:', error)
    // CONFIGURABLE: Use first available chain from chains.json as fallback
    const fallbackChain = {
      id: 1, // Generic fallback - will be overridden by config
      name: 'Fallback Chain',
      network: 'fallback',
      nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
      rpcUrls: { default: { http: ['https://placeholder.com'] }, public: { http: ['https://placeholder.com'] } },
      blockExplorers: { default: { name: 'Explorer', url: 'https://placeholder.com' } },
      testnet: true,
    }
    
    config = createConfig({
      chains: [fallbackChain],
      connectors: [
        injected(),
        coinbaseWallet({
          appName: 'Monad CCIP Faucet',
          appLogoUrl: 'https://via.placeholder.com/128',
        }),
        walletConnect({ projectId }),
      ],
      transports: { [fallbackChain.id]: http() },
    })
    
    return config
  }
}

// Export the initialization function
export { initializeConfig }

// Export a getter for the config
export function getWagmiConfig() {
  if (!config) {
    throw new Error('Wagmi config not initialized. Call initializeConfig() first.')
  }
  return config
}

// Export chains for backward compatibility
export { chains }

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
} 