import { configLoader } from '../core/loader'
import type { ChainConfig, DerivedConfig } from '../core/types'

/**
 * Theme Management - Handles theme generation and application
 * Extracted from auto-derivation.ts for UI-specific functionality
 */
export class ThemeManager {
  private static instance: ThemeManager

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager()
    }
    return ThemeManager.instance
  }

  /**
   * Generate theme colors from the chain's theme color
   */
  private generateTheme(chainConfig: ChainConfig): {
    primaryColor: string
    gradientFrom: string
    gradientTo: string
    cssCustomProperties: Record<string, string>
  } {
    // Use the provided theme color as primary (replaces monad-purple)
    const primaryColor = chainConfig.themeColor
    
    // Create a vibrant gradient that maintains theme color intensity
    const gradientFrom = chainConfig.themeColor // Full theme color on the left
    const chainlinkBlue = '#006FEE'
    
    // Use configurable gradient intensity (default to 0.7 if not specified)
    const intensity = chainConfig.gradientIntensity ?? 0.7
    
    // Create a vibrant middle color that's configurable between theme color and Chainlink blue
    const gradientMid = this.createVibrantMidpoint(chainConfig.themeColor, chainlinkBlue, intensity)
    const gradientTo = chainlinkBlue // Chainlink blue on the right
    
    // CSS custom properties for dynamic theming
    const cssCustomProperties = {
      '--chain-primary': primaryColor, // Configurable primary color (replaces monad-purple)
      '--chainlink-blue': chainlinkBlue, // Static Chainlink blue
      '--chain-gradient-from': gradientFrom,
      '--chain-gradient-mid': gradientMid,
      '--chain-gradient-to': gradientTo,
    }
    
    return {
      primaryColor,
      gradientFrom,
      gradientTo,
      cssCustomProperties
    }
  }

  /**
   * Create a vibrant midpoint that maintains theme color intensity
   */
  private createVibrantMidpoint(themeColor: string, chainlinkBlue: string, intensity: number = 0.7): string {
    // Remove # if present
    const themeHex = themeColor.replace('#', '')
    const blueHex = chainlinkBlue.replace('#', '')
    
    // Convert to RGB
    const themeR = parseInt(themeHex.substr(0, 2), 16)
    const themeG = parseInt(themeHex.substr(2, 2), 16)
    const themeB = parseInt(themeHex.substr(4, 2), 16)
    
    const blueR = parseInt(blueHex.substr(0, 2), 16)
    const blueG = parseInt(blueHex.substr(2, 2), 16)
    const blueB = parseInt(blueHex.substr(4, 2), 16)
    
    // Create a vibrant midpoint with configurable intensity
    // intensity controls how much theme color vs Chainlink blue (0.1-0.9)
    const blueIntensity = 1 - intensity
    const midR = Math.round(themeR * intensity + blueR * blueIntensity)
    const midG = Math.round(themeG * intensity + blueG * blueIntensity)
    const midB = Math.round(themeB * intensity + blueB * blueIntensity)
    
    // Convert back to hex
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
    const result = `#${toHex(midR)}${toHex(midG)}${toHex(midB)}`
    
    // Debug log for color transformation
    console.log(`🎨 Vibrant midpoint: ${themeColor} (${(intensity * 100).toFixed(0)}%) + ${chainlinkBlue} (${(blueIntensity * 100).toFixed(0)}%) → ${result}`)
    
    return result
  }

  /**
   * Get the midpoint color between two hex colors
   */
  private getColorMidpoint(color1: string, color2: string): string {
    // Remove # if present
    const hex1 = color1.replace('#', '')
    const hex2 = color2.replace('#', '')
    
    // Convert to RGB
    const r1 = parseInt(hex1.substr(0, 2), 16)
    const g1 = parseInt(hex1.substr(2, 2), 16)
    const b1 = parseInt(hex1.substr(4, 2), 16)
    
    const r2 = parseInt(hex2.substr(0, 2), 16)
    const g2 = parseInt(hex2.substr(2, 2), 16)
    const b2 = parseInt(hex2.substr(4, 2), 16)
    
    // Calculate midpoint (average)
    const midR = Math.round((r1 + r2) / 2)
    const midG = Math.round((g1 + g2) / 2)
    const midB = Math.round((b1 + b2) / 2)
    
    // Convert back to hex
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
    const result = `#${toHex(midR)}${toHex(midG)}${toHex(midB)}`
    
    // Debug log for red color transformation
    if (color1.toLowerCase().includes('ff0000') || color1.toLowerCase().includes('ff00')) {
      console.log(`🎨 Gradient midpoint: ${color1} + ${color2} → ${result}`)
    }
    
    return result
  }

  /**
   * Create a softer version of a color by blending with white/transparency
   */
  private createSofterColor(hex: string, intensity: number): string {
    // Remove # if present
    hex = hex.replace('#', '')
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Blend with white based on intensity (0 = white, 1 = original color)
    const blendedR = Math.round(r * intensity + 255 * (1 - intensity))
    const blendedG = Math.round(g * intensity + 255 * (1 - intensity))
    const blendedB = Math.round(b * intensity + 255 * (1 - intensity))
    
    // Convert back to hex
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
    const result = `#${toHex(blendedR)}${toHex(blendedG)}${toHex(blendedB)}`
    
    // Debug log for red color transformation
    if (hex.toLowerCase().includes('ff0000') || hex.toLowerCase().includes('ff00')) {
      console.log(`🎨 Color transformation: ${hex} (${intensity * 100}% intensity) → ${result}`)
    }
    
    return result
  }

  /**
   * Generate asset paths from ticker and chain name
   */
  private generateAssetPaths(ticker: string, chainName?: string): {
    networkIcon: string
    nativeTokenIcon: string
    linkTokenIcon: string
    fallbackIcon: string
  } {
    const lowerTicker = ticker.toLowerCase()
    
    return {
      networkIcon: chainName ? `/networks/${chainName}.png` : `/tokens/${lowerTicker}.png`, // Chain-specific logo
      nativeTokenIcon: `/tokens/${lowerTicker}.png`, // Token logo (shared across chains with same token)
      linkTokenIcon: `/tokens/link.png`, // LINK is always the same
      fallbackIcon: `/tokens/placeholder.png` // Generic fallback
    }
  }

  /**
   * Generate UI text from chain config
   */
  private generateUIText(chainConfig: ChainConfig): {
    nativeSymbol: string
    nativeName: string
    pageTitle: string
  } {
    const { ticker, name } = chainConfig
    
    // Extract the first word of the chain name for native name
    // e.g., "Monad Testnet" -> "Monad", "Ethereum Sepolia" -> "Ethereum"
    const nativeName = name.split(' ')[0]
    
    return {
      nativeSymbol: ticker, // MON, ETH, AVAX, etc.
      nativeName, // Monad, Ethereum, Avalanche, etc.
      pageTitle: `PSEUDO (水道)` 
    }
  }

  /**
   * Derive all configuration from a chain config
   * @param chainConfig - The chain configuration
   * @param chainName - Optional chain name in kebab-case for network icon (e.g., "arbitrum-sepolia")
   */
  deriveConfig(chainConfig: ChainConfig, chainName?: string): DerivedConfig {
    const theme = this.generateTheme(chainConfig)
    const assets = this.generateAssetPaths(chainConfig.ticker, chainName)
    const uiText = this.generateUIText(chainConfig)
    
    const derivedConfig: DerivedConfig = {
      // Theme
      primaryColor: theme.primaryColor,
      gradientFrom: theme.gradientFrom,
      gradientTo: theme.gradientTo,
      cssCustomProperties: theme.cssCustomProperties,
      
      // Assets
      networkIcon: assets.networkIcon,           // Chain-specific branding
      nativeTokenIcon: assets.nativeTokenIcon,   // Token icon (can be shared)
      linkTokenIcon: assets.linkTokenIcon,
      fallbackIcon: assets.fallbackIcon,
      
      // UI Text
      nativeSymbol: uiText.nativeSymbol,
      nativeName: uiText.nativeName,
      pageTitle: uiText.pageTitle
    }
    
    console.log(`🎨 Auto-derived config for ${chainConfig.name}:`, derivedConfig)
    return derivedConfig
  }

  /**
   * Get CSS custom properties for the theme
   */
  getThemeCSSProperties(derivedConfig: DerivedConfig): Record<string, string> {
    return {
      '--chain-primary': derivedConfig.primaryColor,
      '--chainlink-blue': '#006FEE', // Static Chainlink blue
      '--chain-gradient-from': derivedConfig.gradientFrom,
      '--chain-gradient-to': derivedConfig.gradientTo,
      '--chain-gradient-mid': derivedConfig.cssCustomProperties['--chain-gradient-mid'],
      '--native-symbol': `"${derivedConfig.nativeSymbol}"`,
      '--native-name': `"${derivedConfig.nativeName}"`
    }
  }

  /**
   * Apply theme to document root
   */
  applyThemeToDocument(derivedConfig: DerivedConfig): void {
    const root = document.documentElement
    const cssProps = this.getThemeCSSProperties(derivedConfig)
    
    Object.entries(cssProps).forEach(([property, value]) => {
      root.style.setProperty(property, value)
    })
    
    // Update document title
    document.title = derivedConfig.pageTitle
    
    console.log(`🎨 Applied theme for ${derivedConfig.nativeName}`)
  }

  /**
   * Get theme for the active chain
   */
  async getActiveTheme(): Promise<DerivedConfig> {
    const chainConfig = await configLoader.getActiveChainConfig()
    return this.deriveConfig(chainConfig)
  }

  /**
   * Apply theme for the active chain
   */
  async applyActiveTheme(): Promise<void> {
    const derivedConfig = await this.getActiveTheme()
    this.applyThemeToDocument(derivedConfig)
  }
}

// Export singleton instance
export const themeManager = ThemeManager.getInstance() 