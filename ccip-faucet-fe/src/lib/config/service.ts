import { configLoader } from './core/loader'
import { themeManager } from './ui/theme'
import type { ChainConfig, HelperChainConfig, DerivedConfig } from './core/types'

/**
 * Unified Configuration Service
 * Provides a clean interface for all configuration functionality
 * Consolidates config-service.ts functionality
 */
export class ConfigService {
  private static instance: ConfigService

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService()
    }
    return ConfigService.instance
  }

  /**
   * Get the complete configuration for the active chain
   */
  async getActiveChainConfig(): Promise<{
    chainConfig: ChainConfig
    helperChainConfig: HelperChainConfig
    derivedConfig: DerivedConfig
  }> {
    try {
      // Load configurations
      const chainConfig = await configLoader.getActiveChainConfig()
      const helperChainConfig = await configLoader.getHelperChainConfig()
      
      // Auto-derive theme, UI text, and asset paths
      const derivedConfig = themeManager.deriveConfig(chainConfig)
      
      return {
        chainConfig,
        helperChainConfig,
        derivedConfig
      }
    } catch (error) {
      console.error('❌ Failed to load active chain configuration:', error)
      throw error
    }
  }

  /**
   * Initialize the application with the active chain configuration
   * CONSOLIDATION: Now includes wallet-chain sync to prevent wrong network states
   */
  async initializeApp(): Promise<{
    chainConfig: ChainConfig
    helperChainConfig: HelperChainConfig
    derivedConfig: DerivedConfig
  }> {
    console.log('🚀 Initializing app with configuration...')
    
    // CONSOLIDATION: Sync with wallet's current chain before loading config
    // This prevents "Wrong Network" buttons when wallet is on a different supported chain
    await configLoader.syncWithWalletOnStartup()
    
    const config = await this.getActiveChainConfig()
    
    // Apply theme to document
    themeManager.applyThemeToDocument(config.derivedConfig)
    
    console.log('✅ App initialized successfully')
    return config
  }

  /**
   * Get supported chains list
   */
  async getSupportedChains(): Promise<string[]> {
    const chainsConfig = await configLoader.loadChainsConfig()
    return chainsConfig.supportedChains
  }

  /**
   * Check if a specific chain is supported
   */
  async isChainSupported(chainName: string): Promise<boolean> {
    const supportedChains = await this.getSupportedChains()
    return supportedChains.includes(chainName)
  }

  /**
   * Get configuration for a specific chain (for future multi-chain support)
   */
  async getChainConfig(chainName: string): Promise<{
    chainConfig: ChainConfig
    derivedConfig: DerivedConfig
  }> {
    const chainConfig = await configLoader.loadChainConfig(chainName)
    const derivedConfig = themeManager.deriveConfig(chainConfig)
    
    return {
      chainConfig,
      derivedConfig
    }
  }

  /**
   * Clear all configuration caches
   */
  clearCache(): void {
    configLoader.clearCache()
    console.log('🧹 All configuration caches cleared')
  }

  /**
   * Get theme for the active chain
   */
  async getActiveTheme(): Promise<DerivedConfig> {
    return themeManager.getActiveTheme()
  }

  /**
   * Apply theme for the active chain
   */
  async applyActiveTheme(): Promise<void> {
    return themeManager.applyActiveTheme()
  }
}

// Export singleton instance
export const configService = ConfigService.getInstance() 