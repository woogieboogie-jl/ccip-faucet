/**
 * Test the chain configuration consolidation
 */

import { 
  getActiveChain, 
  getHelperChain, 
  createConfigDrivenPublicClient,
  getChainConstants,
  getAddresses 
} from './index'

export async function testChainConfig() {
  console.log('🧪 Testing chain configuration consolidation...')
  
  try {
    // Test getting active chain
    const activeChain = await getActiveChain()
    console.log('✅ Active chain loaded:', {
      id: activeChain.id,
      name: activeChain.name,
      rpcUrl: activeChain.rpcUrls.default.http[0]
    })
    
    // Test getting helper chain
    const helperChain = await getHelperChain()
    console.log('✅ Helper chain loaded:', {
      id: helperChain.id,
      name: helperChain.name,
      rpcUrl: helperChain.rpcUrls.default.http[0]
    })
    
    // Test creating public client
    const publicClient = await createConfigDrivenPublicClient()
    console.log('✅ Public client created successfully')
    
    // Test getting chain constants
    const constants = await getChainConstants()
    console.log('✅ Chain constants loaded:', {
      activeChainId: constants.ACTIVE_CHAIN_ID,
      activeChainName: constants.ACTIVE_CHAIN_NAME,
      faucetAddress: constants.FAUCET_ADDRESS
    })
    
    // Test getting addresses
    const addresses = await getAddresses()
    console.log('✅ Addresses loaded:', {
      faucetAddress: addresses.FAUCET_ADDRESS,
      helperAddress: addresses.HELPER_ADDRESS,
      linkToken: addresses.ACTIVE_CHAIN_LINK_TOKEN
    })
    
    return {
      success: true,
      activeChain,
      helperChain,
      constants,
      addresses
    }
  } catch (error) {
    console.error('❌ Chain config test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  ;(window as any).testChainConfig = testChainConfig
  console.log('🧪 Chain config test function loaded: testChainConfig()')
} 