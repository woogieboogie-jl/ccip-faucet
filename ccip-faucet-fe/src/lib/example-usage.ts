// CONSOLIDATED: Use main config system instead of legacy config-service
import { configService } from '@/lib/config'

/**
 * Example usage of the configuration system
 * This shows how to use the auto-derivation in practice
 */
export async function exampleUsage() {
  try {
    // Initialize app with configuration
    const config = await configService.initializeApp()
    
    console.log('=== EXAMPLE CONFIGURATION OUTPUT ===')
    console.log('Chain Config:', config.chainConfig)
    console.log('Helper Chain Config:', config.helperChainConfig)
    console.log('Auto-Derived Config:', config.derivedConfig)
    
    // Example: How to use derived values
    console.log('\n=== AUTO-DERIVED VALUES ===')
    console.log('Native Symbol:', config.derivedConfig.nativeSymbol) // e.g., "MON", "AVAX", "ETH"
    console.log('Native Name:', config.derivedConfig.nativeName) // e.g., "Monad", "Avalanche", "Ethereum"
    console.log('Page Title:', config.derivedConfig.pageTitle) // "Monad Faucet - KEEP CALM AND BUILD WITH MON"
    console.log('Native Token Icon:', config.derivedConfig.nativeTokenIcon) // "/tokens/mon.png"
    console.log('Theme Color:', config.derivedConfig.primaryColor) // "#8A5CF6"
    
    // Example: How to use in React components
    console.log('\n=== REACT COMPONENT USAGE EXAMPLE ===')
    console.log(`
    // In your React component:
    const { derivedConfig } = await configService.getActiveChainConfig()
    
    // Use auto-derived values:
    <img src={derivedConfig.nativeTokenIcon} alt={derivedConfig.nativeSymbol} />
    <h1>{derivedConfig.nativeName} Faucet</h1>
    <span>{derivedConfig.nativeSymbol}</span>
    
    // Theme is automatically applied to document.documentElement
    `)
    
    return config
  } catch (error) {
    console.error('❌ Configuration example failed:', error)
    throw error
  }
}

// Test function for development
export async function testAutoDerivation() {
  console.log('🧪 Testing auto-derivation...')
  
  // Test with current Monad config
  const config = await exampleUsage()
  
  // Verify expected values
  const expected = {
    nativeSymbol: 'TKN', // Generic example
    nativeName: 'Token', // Generic example
    pageTitle: 'Monad Faucet - KEEP CALM AND BUILD WITH MON',
    nativeTokenIcon: '/tokens/mon.png',
    linkTokenIcon: '/tokens/link.png'
  }
  
  console.log('\n=== VERIFICATION ===')
  Object.entries(expected).forEach(([key, expectedValue]) => {
    const actualValue = config.derivedConfig[key as keyof typeof config.derivedConfig]
    const match = actualValue === expectedValue
    console.log(`${match ? '✅' : '❌'} ${key}: ${actualValue} ${match ? '(matches)' : `(expected: ${expectedValue})`}`)
  })
  
  return config
} 