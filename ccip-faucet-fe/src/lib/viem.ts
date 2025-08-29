import { createPublicClient, http } from 'viem'
import { type Transport } from 'viem'
import { createConfigDrivenPublicClient } from './config/chain/viem-client'

// Use config-driven public client instead of hardcoded one
let publicClient: any = null

// Initialize public client asynchronously
async function initializePublicClient() {
  try {
    publicClient = await createConfigDrivenPublicClient()
    return publicClient
  } catch (error) {
    console.error('Failed to initialize config-driven public client:', error)
    // CONFIGURABLE: Generic fallback - will be overridden by config
    const fallbackChain = {
      id: 1, // Generic fallback - will be overridden by config
      name: 'Fallback Chain',
      network: 'fallback',
      nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
      rpcUrls: { default: { http: ['https://placeholder.com'] }, public: { http: ['https://placeholder.com'] } },
      blockExplorers: { default: { name: 'Explorer', url: 'https://placeholder.com' } },
      testnet: true,
    }
    
    publicClient = createPublicClient({
      chain: fallbackChain,
      transport: http('https://placeholder.com') as Transport,
    })
    
    return publicClient
  }
}

// Export the initialization function
export { initializePublicClient }

// Export a getter for the public client
export function getPublicClient() {
  if (!publicClient) {
    throw new Error('Public client not initialized. Call initializePublicClient() first.')
  }
  return publicClient
}

// Export for backward compatibility (will be deprecated)
export { publicClient } 