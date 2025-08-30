import { createPublicClient, http, type PublicClient } from 'viem'
import { createConfigDrivenPublicClient, getHelperChain } from './config/chain/viem-client'

/**
 * Simple, centralized public client service
 * Single point of truth for all client creation across the app
 */
export class PublicClientService {
  private static instance: PublicClientService
  private clients: Map<string, PublicClient> = new Map()
  
  private constructor() {}
  
  static getInstance(): PublicClientService {
    if (!PublicClientService.instance) {
      PublicClientService.instance = new PublicClientService()
    }
    return PublicClientService.instance
  }
  
  /**
   * Get the active chain public client (config-driven)
   */
  async getClient(): Promise<PublicClient> {
    if (!this.clients.has('active')) {
      console.log('🔧 Creating active chain client...')
      const client = await createConfigDrivenPublicClient()
      this.clients.set('active', client)
      console.log('✅ Active chain client created and cached')
    }
    return this.clients.get('active')!
  }
  
  /**
   * Get the helper chain public client (config-driven)
   */
  async getHelperClient(): Promise<PublicClient> {
    if (!this.clients.has('helper')) {
      console.log('🔧 Creating helper chain client...')
      const helperChain = await getHelperChain()
      const client = createPublicClient({
        chain: helperChain,
        transport: http(helperChain.rpcUrls.default.http[0])
      })
      this.clients.set('helper', client)
      console.log('✅ Helper chain client created and cached')
    }
    return this.clients.get('helper')!
  }
  
  /**
   * Clear cached clients (useful for testing or chain switching)
   */
  clearCache(): void {
    console.log('🧹 Clearing client cache...')
    this.clients.clear()
  }

  /**
   * Smart cache invalidation - only clear specific chain clients
   */
  clearChainCache(chainId?: number): void {
    if (chainId) {
      const key = chainId.toString()
      this.clients.delete(key)
      console.log(`🧹 Cleared client cache for chain ${chainId}`)
    } else {
      // Clear active and helper clients for chain switches
      this.clients.delete('active')
      this.clients.delete('helper')
      console.log('🧹 Cleared active and helper client cache')
    }
  }
  
  /**
   * Get client by chain ID (for future extensibility)
   */
  async getClientByChainId(chainId: number): Promise<PublicClient> {
    const key = chainId.toString()
    
    if (!this.clients.has(key)) {
      console.log(`🔧 Creating client for chain ${chainId}...`)
      
      if (chainId === 10143) { // Monad Testnet
        const client = await createConfigDrivenPublicClient()
        this.clients.set(key, client)
      } else if (chainId === 43113) { // Avalanche Fuji
        const client = await this.getHelperClient()
        this.clients.set(key, client)
      } else {
        throw new Error(`Unsupported chain ID: ${chainId}`)
      }
      
      console.log(`✅ Client for chain ${chainId} created and cached`)
    }
    
    return this.clients.get(key)!
  }
}

/**
 * Convenience function for getting the active client
 */
export async function getPublicClient(): Promise<PublicClient> {
  return PublicClientService.getInstance().getClient()
}

/**
 * Convenience function for getting the helper client
 */
export async function getHelperPublicClient(): Promise<PublicClient> {
  return PublicClientService.getInstance().getHelperClient()
} 