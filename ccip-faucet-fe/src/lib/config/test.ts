/**
 * Test the main configuration interface
 */

import { 
  configService,
  getActiveChain,
  createConfigDrivenPublicClient,
  getAddresses,
  getConstants,
  themeManager
} from './index'

export async function testMainConfig() {
  console.log('🧪 Testing main configuration interface...')
  
  try {
    // Test unified config service
    const config = await configService.getActiveChainConfig()
    console.log('✅ Unified config service loaded:', {
      chainName: config.chainConfig.name,
      chainId: config.chainConfig.chainId,
      themeColor: config.derivedConfig.primaryColor
    })
    
    // Test chain functionality
    const activeChain = await getActiveChain()
    console.log('✅ Active chain loaded:', {
      id: activeChain.id,
      name: activeChain.name,
      rpcUrl: activeChain.rpcUrls.default.http[0]
    })
    
    // Test public client creation
    const publicClient = await createConfigDrivenPublicClient()
    console.log('✅ Public client created successfully')
    
    // Test addresses
    const addresses = await getAddresses()
    console.log('✅ Addresses loaded:', {
      faucetAddress: addresses.FAUCET_ADDRESS,
      linkToken: addresses.ACTIVE_CHAIN_LINK_TOKEN
    })
    
    // Test constants
    const constants = await getConstants()
    console.log('✅ Constants loaded:', {
      activeChainName: constants.ACTIVE_CHAIN_NAME,
      activeChainId: constants.ACTIVE_CHAIN_ID
    })
    
    // Test theme manager
    const theme = await themeManager.getActiveTheme()
    console.log('✅ Theme loaded:', {
      primaryColor: theme.primaryColor,
      nativeSymbol: theme.nativeSymbol,
      nativeName: theme.nativeName
    })
    
    return {
      success: true,
      config,
      activeChain,
      addresses,
      constants,
      theme
    }
  } catch (error) {
    console.error('❌ Main config test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  ;(window as any).testMainConfig = testMainConfig
  console.log('🧪 Main config test function loaded: testMainConfig()')
} 