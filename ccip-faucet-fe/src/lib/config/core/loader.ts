import type { ChainConfig, HelperChainConfig } from './types'

/**
 * Configuration Loader - Loads and resolves chain configurations
 */
export class ConfigLoader {
  private static instance: ConfigLoader
  private chainsConfig: { supportedChains: string[] } | null = null
  private chainConfigs: Map<string, ChainConfig> = new Map()
  private helperChainConfigs: Map<string, HelperChainConfig> = new Map()
  private selectedChainName: string | null = null

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader()
    }
    return ConfigLoader.instance
  }

  /**
   * Resolve environment variables in a string
   * Replaces ${VAR_NAME} with import.meta.env.VITE_VAR_NAME (Vite environment variables)
   */
  private resolveEnvVars(value: string): string {
    return value.replace(/\${([^}]+)}/g, (_, varName) => {
      // Try VITE_ prefixed version first (for frontend)
      const viteVarName = `VITE_${varName}`
      const envValue = import.meta.env[viteVarName]
      
      console.log(`🔍 Resolving ${varName}:`)
      console.log(`   📍 Looking for: ${viteVarName}`)
      console.log(`   📍 Found value: ${envValue ? 'YES' : 'NO'}`)
      if (envValue) {
        console.log(`   📍 Value: ${envValue.substring(0, 20)}${envValue.length > 20 ? '...' : ''}`)
      }
      
      if (!envValue) {
        console.warn(`⚠️ Environment variable ${viteVarName} not found`)
        return value // Return original if not found
      }
      
      console.log(`🔧 Resolved ${varName} -> ${viteVarName}`)
      return envValue
    })
  }

  /**
   * Recursively resolve environment variables in an object
   */
  private resolveObjectEnvVars(obj: any): any {
    if (typeof obj === 'string') {
      return this.resolveEnvVars(obj)
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveObjectEnvVars(item))
    }
    if (obj && typeof obj === 'object') {
      const resolved: any = {}
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveObjectEnvVars(value)
      }
      return resolved
    }
    return obj
  }

  /**
   * Load the main chains configuration
   */
  async loadChainsConfig(): Promise<{ supportedChains: string[] }> {
    if (this.chainsConfig) {
      return this.chainsConfig
    }

    try {
      console.log('📋 Loading chains config...')
      console.log('🔍 Looking for config at: /configs/chains.json')
      
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch('/configs/chains.json', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache', // Prevent caching issues
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`Failed to load chains.json: ${response.status} ${response.statusText}`)
      }
      
      this.chainsConfig = await response.json()
      console.log('✅ Loaded chains config:', this.chainsConfig)
      return this.chainsConfig!
    } catch (error) {
      console.error('❌ Failed to load chains config:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Configuration loading timed out. Please check your network connection.')
      }
      throw error
    }
  }

  /**
   * Load a specific chain configuration
   */
  async loadChainConfig(chainName: string): Promise<ChainConfig> {
    if (this.chainConfigs.has(chainName)) {
      return this.chainConfigs.get(chainName)!
    }

    try {
      console.log(`⛓️ Loading chain config for ${chainName}...`)
      console.log(`🔍 Looking for config at: /configs/chains/${chainName}.json`)
      
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch(`/configs/chains/${chainName}.json`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache', // Prevent caching issues
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`Failed to load chain config for ${chainName}: ${response.status} ${response.statusText}`)
      }
      
      const rawConfig = await response.json()
      console.log(`📄 Raw config for ${chainName}:`, rawConfig)
      
      const resolvedConfig = this.resolveObjectEnvVars(rawConfig) as ChainConfig
      console.log(`🔧 Resolved config for ${chainName}:`, resolvedConfig)
      
      this.chainConfigs.set(chainName, resolvedConfig)
      console.log(`✅ Loaded chain config for ${chainName}:`, resolvedConfig)
      return resolvedConfig
    } catch (error) {
      console.error(`❌ Failed to load chain config for ${chainName}:`, error)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Configuration loading timed out for ${chainName}. Please check your network connection.`)
      }
      throw error
    }
  }

  /**
   * Load a helper chain configuration
   */
  async loadHelperChainConfig(helperChainName: string): Promise<HelperChainConfig> {
    if (this.helperChainConfigs.has(helperChainName)) {
      return this.helperChainConfigs.get(helperChainName)!
    }

    try {
      const response = await fetch(`/configs/chains/helpers/${helperChainName}.json`)
      if (!response.ok) {
        throw new Error(`Failed to load helper chain config for ${helperChainName}: ${response.status}`)
      }
      const rawConfig = await response.json()
      const resolvedConfig = this.resolveObjectEnvVars(rawConfig) as HelperChainConfig
      
      this.helperChainConfigs.set(helperChainName, resolvedConfig)
      console.log(`🔗 Loaded helper chain config for ${helperChainName}:`, resolvedConfig)
      return resolvedConfig
    } catch (error) {
      console.error(`❌ Failed to load helper chain config for ${helperChainName}:`, error)
      throw error
    }
  }

  /**
   * Get current user address from wallet for user-specific data fetching
   */
  private async getCurrentUserAddress(): Promise<`0x${string}` | undefined> {
    try {
      // Try to get user address from window.ethereum
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_accounts'
        })
        return accounts[0] as `0x${string}` | undefined
      }
    } catch (error) {
      console.warn('Could not get user address for faucet data refresh:', error)
    }
    return undefined
  }

  /**
   * CONSOLIDATION: Get supported chain IDs for multi-chain validation
   * Moved from useRainbowKitNetworkSwitch for reuse across the app
   */
  async getSupportedChainIds(): Promise<number[]> {
    try {
      const chainsConfig = await this.loadChainsConfig()
      const supportedChains = chainsConfig.supportedChains || []
      
      // Load chain details to get IDs using cached config loader
      const chainIds: number[] = []
      for (const chainName of supportedChains) {
        try {
          const chainData = await this.loadChainConfig(chainName)
          chainIds.push(chainData.chainId)
        } catch (error) {
          console.warn(`Failed to load chain config for ${chainName}:`, error)
        }
      }
      
      console.log('🔗 ConfigLoader: Supported chain IDs:', chainIds)
      return chainIds
    } catch (error) {
      console.error('Failed to load supported chain IDs:', error)
      return []
    }
  }

  /**
   * CONSOLIDATION: Sync app's active chain with wallet's current chain on startup
   * Prevents "Wrong Network" buttons when wallet is on a different supported chain
   */
  async syncWithWalletOnStartup(): Promise<void> {
    try {
      console.log('🔗 Attempting to sync app config with wallet chain...')
      
      // Get wallet's current chain ID
      const walletChainId = typeof window !== 'undefined' && (window as any).ethereum?.chainId 
        ? parseInt((window as any).ethereum.chainId, 16) 
        : null

      if (!walletChainId) {
        console.log('📱 No wallet detected or not connected - using default chain')
        return
      }

      console.log('📱 Wallet is on chain ID:', walletChainId)
      
      // Check if wallet chain is supported
      const supportedChainIds = await this.getSupportedChainIds()
      if (!supportedChainIds.includes(walletChainId)) {
        console.log('⚠️ Wallet chain not supported - keeping default chain')
        console.log('   Supported chains:', supportedChainIds)
        return
      }
      
      // Map chainId to chainName and switch app config
      const chainName = await this.mapChainIdToName(walletChainId)
      if (chainName) {
        console.log(`🔄 Syncing app to wallet chain: ${chainName} (${walletChainId})`)
        await this.setActiveChain(chainName)
        console.log(`✅ Successfully synced app config with wallet chain: ${chainName}`)
      } else {
        console.warn('⚠️ Could not map wallet chain ID to chain name:', walletChainId)
      }
    } catch (error) {
      console.warn('⚠️ Failed to sync with wallet chain (non-critical):', error)
      console.warn('   → App will use default chain configuration')
    }
  }

  /**
   * Set the active chain for dynamic switching
   * Now async to properly coordinate cache clearing
   */
  async setActiveChain(chainName: string): Promise<void> {
    console.log(`🔄 ConfigLoader: Switching active chain to: ${chainName}`)
    console.log(`🔍 ConfigLoader: Previous selectedChainName was: ${this.selectedChainName}`)
    this.selectedChainName = chainName
    console.log(`✅ ConfigLoader: selectedChainName updated to: ${this.selectedChainName}`)
    
    try {
      // Clear caches to force reload with new chain
      this.clearCache()
      
      // Clear other service caches synchronously to avoid race conditions
      const [
        { clearChainConfigCache },
        { clearAddressesCache },
        { PublicClientService },
        { invalidateAllFaucetCache },
        { clearFaucetClientCache }
      ] = await Promise.all([
        import('./../../config/chain/viem-client'),
        import('./../../config/chain/addresses'),
        import('./../../public-client'),
        import('./../../request-cache'),
        import('./../../faucetClient')
      ])
      
      // Execute all cache clears
      clearChainConfigCache()
      clearAddressesCache()
      PublicClientService.getInstance().clearCache()
      invalidateAllFaucetCache() // 🆕 Clear RPC cache too!
      clearFaucetClientCache() // 🆕 Clear cached faucet address too!
      
      // Clear Zustand address state and reload
      try {
        const { useFaucetStore } = await import('../../../store/faucet-store')
        const store = useFaucetStore.getState()
        store.clearAddresses()
        // Reload addresses for new chain
        await store.loadAddresses()
        console.log('🏪 Zustand address state cleared and reloaded')
        
        // 🆕 CONSOLIDATION: Trigger faucet data refresh via existing hook mechanism
        // This ensures we use the established data flow instead of duplicating logic
        const userAddress = await this.getCurrentUserAddress()
        
        // 🔧 FIX RACE CONDITION: Wait for useRequireActiveChain to update supportedChainIds
        // before dispatching the refresh event to ensure validation passes
        console.log('⏳ [DEBUG] Waiting for network validation to update before dispatching refresh event...')
        console.log('   → Chain name:', chainName)
        console.log('   → User address:', userAddress || 'none')
        console.log('   → Timestamp:', new Date().toISOString())
        
        setTimeout(() => {
          console.log('🚀 [DEBUG] Dispatching faucet-refresh-needed event now...')
          console.log('   → Timeout completed, dispatching event')
          console.log('   → Timestamp:', new Date().toISOString())
          
          const refreshEvent = new CustomEvent('faucet-refresh-needed', { 
            detail: { userAddress } 
          })
          window.dispatchEvent(refreshEvent)
          
          console.log('✅ [DEBUG] Faucet refresh event dispatched for new chain (after validation update)', { 
            userAddress: userAddress || 'none',
            eventDetail: refreshEvent.detail,
            timestamp: new Date().toISOString()
          })
        }, 150) // Wait longer than useRequireActiveChain's 100ms delay
      } catch (error) {
        console.warn('⚠️ Failed to clear Zustand address state or refresh faucet data:', error)
      }
      
      // 🆕 Trigger balance refreshes for new chain
      try {
        const { invalidateUserCache } = await import('./../../request-cache')
        invalidateUserCache() // Clear user balance caches
        console.log('💰 Balance caches cleared - will refresh on next fetch')
      } catch (error) {
        console.warn('⚠️ Failed to clear balance caches:', error)
      }
      
      console.log('🧹 All caches cleared successfully')
      
      // Apply new theme using ConfigService (this will get fresh config)
      try {
        const { configService } = await import('./../service')
        await configService.applyActiveTheme()
        console.log('🎨 Theme applied successfully')
      } catch (error) {
        console.error('Failed to apply theme for new chain:', error)
      }
      
      console.log(`✅ Active chain set to: ${chainName}`)
    } catch (error) {
      console.error('❌ Failed to switch active chain:', error)
      throw error
    }
  }

  /**
   * Get the current active chain name
   */
  getActiveChainName(): string | null {
    return this.selectedChainName
  }



  /**
   * Map chainId to chainName for dynamic switching
   */
  async mapChainIdToName(chainId: number): Promise<string | null> {
    try {
      const chainsConfig = await this.loadChainsConfig()
      
      // Load all supported chains and find matching chainId
      for (const chainName of chainsConfig.supportedChains) {
        try {
          const config = await this.loadChainConfig(chainName)
          if (config.chainId === chainId) {
            return chainName
          }
        } catch (error) {
          console.warn(`Failed to load config for ${chainName}:`, error)
        }
      }
      
      console.warn(`No chain config found for chainId: ${chainId}`)
      return null
    } catch (error) {
      console.error('Failed to map chainId to chainName:', error)
      return null
    }
  }

  /**
   * Get the current active chain configuration
   * Uses selected chain or falls back to first supported chain
   */
  async getActiveChainConfig(): Promise<ChainConfig> {
    const chainsConfig = await this.loadChainsConfig()
    const activeChainName = this.selectedChainName || chainsConfig.supportedChains[0]
    
    console.log(`🔍 ConfigLoader: getActiveChainConfig called`)
    console.log(`🔍 ConfigLoader: selectedChainName = ${this.selectedChainName}`)
    console.log(`🔍 ConfigLoader: supportedChains[0] = ${chainsConfig.supportedChains[0]}`)
    console.log(`🔍 ConfigLoader: activeChainName = ${activeChainName}`)
    
    if (!activeChainName) {
      throw new Error('No supported chains found in configuration')
    }
    
    console.log(`📋 ConfigLoader: Loading active chain config for: ${activeChainName}`)
    const chainConfig = await this.loadChainConfig(activeChainName)
    console.log(`📋 ConfigLoader: Loaded chain config - ticker: ${chainConfig.ticker}, name: ${chainConfig.name}`)
    return chainConfig
  }

  /**
   * Get helper chain config for the active chain
   */
  async getHelperChainConfig(): Promise<HelperChainConfig> {
    const activeChain = await this.getActiveChainConfig()
    return this.loadHelperChainConfig(activeChain.ccip.helperChain)
  }

  /**
   * Clear all cached configurations
   */
  clearCache(): void {
    this.chainsConfig = null
    this.chainConfigs.clear()
    this.helperChainConfigs.clear()
    console.log('🧹 Configuration cache cleared')
  }
}

// Export singleton instance
export const configLoader = ConfigLoader.getInstance() 