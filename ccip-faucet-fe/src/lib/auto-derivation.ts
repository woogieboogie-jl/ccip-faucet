import type { ChainConfig, DerivedConfig } from './types/config'

/**
 * Auto-derivation utilities for theme, UI text, and asset paths
 * Currently simplified - can be expanded for more complex derivation logic
 */
export const autoDerivation = {
  /**
   * Derive configuration from chain config
   */
  deriveConfig(chainConfig: ChainConfig): DerivedConfig {
    return {
      // Theme
      primaryColor: chainConfig.themeColor || '#8A5CF6',
      gradientFrom: chainConfig.themeColor || '#8A5CF6',
      gradientTo: chainConfig.themeColor || '#8A5CF6',
      cssCustomProperties: {
        '--chain-theme-color': chainConfig.themeColor || '#8A5CF6',
      },
      
      // Assets
      nativeTokenIcon: `/tokens/${chainConfig.ticker.toLowerCase()}.png`,
      linkTokenIcon: '/tokens/link.png',
      
      // UI Text
      nativeSymbol: chainConfig.ticker, // Use the ticker from config (e.g., "MON", "AVAX", "ETH")
      nativeName: chainConfig.name,
      pageTitle: `${chainConfig.name} Faucet - KEEP CALM AND BUILD ${chainConfig.ticker} & LINK`,
      
      // Fallbacks
      fallbackIcon: '/tokens/mon.png', // Use MON as fallback
    }
  },

  /**
   * Apply theme to document
   */
  applyThemeToDocument(derivedConfig: DerivedConfig): void {
    // Apply theme color to CSS custom properties
    if (derivedConfig.primaryColor) {
      document.documentElement.style.setProperty('--chain-theme-color', derivedConfig.primaryColor)
    }
  }
} 