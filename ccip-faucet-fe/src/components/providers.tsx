import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getWagmiConfig } from '@/lib/wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { useState, useEffect } from 'react'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<any>(null)
  const [chains, setChains] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeWagmi = async () => {
      try {
        const wagmiConfig = getWagmiConfig()
        setConfig(wagmiConfig)
        setChains(wagmiConfig.chains)
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to initialize wagmi config:', error)
        // If config is not initialized yet, wait a bit and try again
        setTimeout(() => {
          const wagmiConfig = getWagmiConfig()
          setConfig(wagmiConfig)
          setChains(wagmiConfig.chains)
          setIsLoading(false)
        }, 100)
      }
    }

    initializeWagmi()
  }, [])

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing wallet connection...</p>
        </div>
      </div>
    )
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          chains={chains}
          theme={darkTheme({ accentColor: '#884DFF', accentColorForeground: 'white', borderRadius: 'small' })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
} 