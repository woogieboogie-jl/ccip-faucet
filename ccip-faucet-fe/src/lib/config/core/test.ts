/**
 * Test the core configuration loading
 */

import { configLoader } from './loader'

export async function testCoreConfig() {
  console.log('🧪 Testing core configuration loading...')
  
  try {
    // Test loading chains config
    const chainsConfig = await configLoader.loadChainsConfig()
    console.log('✅ Chains config loaded:', chainsConfig)
    
    // Test loading active chain config
    const activeChain = await configLoader.getActiveChainConfig()
    console.log('✅ Active chain config loaded:', {
      name: activeChain.name,
      chainId: activeChain.chainId,
      rpcUrl: activeChain.rpcUrl.substring(0, 30) + '...'
    })
    
    // Test loading helper chain config
    const helperChain = await configLoader.getHelperChainConfig()
    console.log('✅ Helper chain config loaded:', {
      name: helperChain.name,
      chainId: helperChain.chainId,
      rpcUrl: helperChain.rpcUrl.substring(0, 30) + '...'
    })
    
    return {
      success: true,
      chainsConfig,
      activeChain,
      helperChain
    }
  } catch (error) {
    console.error('❌ Core config test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  ;(window as any).testCoreConfig = testCoreConfig
  console.log('🧪 Core config test function loaded: testCoreConfig()')
} 