import { useState } from 'react'
import { getAddresses, configService } from '@/lib/config'

// Simple placeholder functions for debug tests
const testWalletPersistence = () => ({
  wagmiConnected: 'Not implemented',
  wagmiAccount: 'Not implemented'
})

const debugRPCConnection = async () => ({
  success: false,
  error: 'RPC debug not implemented',
  blockNumber: 0,
  reservoirStatus: { monPool: 0, linkPool: 0 }
})

export function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runDebugTests = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('🧪 Running comprehensive debug tests...')
      
      // Test 1: Configuration loading
      console.log('1. Testing configuration loading...')
      const config = await configService.getActiveChainConfig()
      console.log('✅ Config loaded:', config)
      
      // Test 2: Addresses loading
      console.log('2. Testing addresses loading...')
      const addresses = await getAddresses()
      console.log('✅ Addresses loaded:', addresses)
      
      // Test 3: Wallet persistence
      console.log('3. Testing wallet persistence...')
      const walletTest = testWalletPersistence()
      console.log('✅ Wallet test:', walletTest)
      
      // Test 4: RPC connection
      console.log('4. Testing RPC connection...')
      const rpcTest = await debugRPCConnection()
      console.log('✅ RPC test:', rpcTest)
      
      // Test 5: Environment variables
      console.log('5. Testing environment variables...')
      const envVars = {
        MONAD_TESTNET_RPC_URL: import.meta.env.VITE_MONAD_TESTNET_RPC_URL,
        PIMLICO_API_KEY: import.meta.env.VITE_PIMLICO_API_KEY,
        WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      }
      console.log('✅ Environment variables:', envVars)
      
      setDebugInfo({
        config,
        addresses,
        walletTest,
        rpcTest,
        envVars,
        timestamp: new Date().toISOString(),
      })
      
    } catch (err) {
      console.error('❌ Debug test failed:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 shadow-2xl max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-100">🐛 Debug Panel</h2>
        <button
          onClick={runDebugTests}
          disabled={isLoading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isLoading ? 'Running Tests...' : 'Run Debug Tests'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
          <h3 className="text-red-400 font-semibold mb-2">Error</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {debugInfo && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Configuration */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-gray-200 font-semibold mb-2">Configuration</h3>
              <div className="text-xs text-gray-300 space-y-1">
                <div><strong>Chain ID:</strong> {debugInfo.config.chainId}</div>
                <div><strong>Name:</strong> {debugInfo.config.name}</div>
                <div><strong>Ticker:</strong> {debugInfo.config.ticker}</div>
                <div><strong>RPC URL:</strong> {debugInfo.config.rpcUrl?.substring(0, 50)}...</div>
              </div>
            </div>

            {/* Addresses */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-gray-200 font-semibold mb-2">Contract Addresses</h3>
              <div className="text-xs text-gray-300 space-y-1">
                <div><strong>Faucet:</strong> {debugInfo.addresses.FAUCET_ADDRESS}</div>
                <div><strong>LINK Token:</strong> {debugInfo.addresses.ACTIVE_CHAIN_LINK_TOKEN}</div>
                <div><strong>CCIP Router:</strong> {debugInfo.addresses.ACTIVE_CHAIN_CCIP_ROUTER}</div>
              </div>
            </div>

            {/* RPC Test */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-gray-200 font-semibold mb-2">RPC Connection</h3>
              <div className="text-xs text-gray-300 space-y-1">
                <div><strong>Success:</strong> {debugInfo.rpcTest.success ? '✅' : '❌'}</div>
                {debugInfo.rpcTest.success && (
                  <>
                    <div><strong>Block Number:</strong> {debugInfo.rpcTest.blockNumber}</div>
                    <div><strong>MON Pool:</strong> {debugInfo.rpcTest.reservoirStatus?.monPool}</div>
                    <div><strong>LINK Pool:</strong> {debugInfo.rpcTest.reservoirStatus?.linkPool}</div>
                  </>
                )}
                {debugInfo.rpcTest.error && (
                  <div className="text-red-400"><strong>Error:</strong> {debugInfo.rpcTest.error}</div>
                )}
              </div>
            </div>

            {/* Wallet Test */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-gray-200 font-semibold mb-2">Wallet Persistence</h3>
              <div className="text-xs text-gray-300 space-y-1">
                <div><strong>Connected:</strong> {debugInfo.walletTest.wagmiConnected || 'Not found'}</div>
                <div><strong>Account:</strong> {debugInfo.walletTest.wagmiAccount || 'Not found'}</div>
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-gray-200 font-semibold mb-2">Environment Variables</h3>
            <div className="text-xs text-gray-300 space-y-1">
              <div><strong>MONAD_TESTNET_RPC_URL:</strong> {debugInfo.envVars.MONAD_TESTNET_RPC_URL ? '✅ Set' : '❌ Missing'}</div>
              <div><strong>PIMLICO_API_KEY:</strong> {debugInfo.envVars.PIMLICO_API_KEY ? '✅ Set' : '❌ Missing'}</div>
              <div><strong>WALLETCONNECT_PROJECT_ID:</strong> {debugInfo.envVars.WALLETCONNECT_PROJECT_ID ? '✅ Set' : '❌ Missing'}</div>
            </div>
          </div>

          <div className="text-xs text-gray-400 text-center">
            Last updated: {new Date(debugInfo.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
} 