import { useState, useEffect } from 'react'
import { useAccount, useChainId, useWalletClient, useSwitchChain } from 'wagmi'
import { getActiveChain } from '@/lib/config'
import { configLoader } from '@/lib/config'

interface NetworkSwitchState {
  isWrongNetwork: boolean
  isUnsupportedNetwork: boolean
  currentChainId: number | undefined
  targetChainId: number
  targetChainName: string
  isSwitching: boolean
  switchError: string | null
  isModalOpen: boolean
}

// Get the actual wallet chain ID, bypassing Wagmi's normalization
function getActualChainId(wagmiChainId: number | undefined, walletClient: any): number | undefined {
  // Use window.ethereum.chainId as primary source since it's the only reliable way
  // to detect when wallet is on unsupported chains. Wagmi normalizes unsupported chains
  // to the first configured chain, which is misleading.
  const windowChainId = typeof window !== 'undefined' && (window as any).ethereum?.chainId 
    ? parseInt((window as any).ethereum.chainId, 16) 
    : undefined
  
  return windowChainId ?? walletClient?.chain?.id ?? wagmiChainId
}

async function getSupportedChainIds(): Promise<number[]> {
  try {
    const chainsConfig = await configLoader.loadChainsConfig()
    const supportedChains = chainsConfig.supportedChains || []
    
    // Load chain details to get IDs using cached config loader
    const chainIds: number[] = []
    for (const chainName of supportedChains) {
      try {
        const chainData = await configLoader.loadChainConfig(chainName)
        chainIds.push(chainData.chainId)
      } catch (error) {
        console.warn(`Failed to load chain config for ${chainName}:`, error)
      }
    }
    
    return chainIds
  } catch (error) {
    console.error('Failed to load supported chain IDs:', error)
    return []
  }
}

export function useRainbowKitNetworkSwitch() {
  const { isConnected } = useAccount()
  const fallbackChainId = useChainId()
  const { data: walletClient } = useWalletClient({})
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()
  
  const [state, setState] = useState<NetworkSwitchState>({
    isWrongNetwork: false,
    isUnsupportedNetwork: false,
    currentChainId: undefined,
    targetChainId: 0,
    targetChainName: '',
    isSwitching: false,
    switchError: null,
    isModalOpen: false,
  })

  const [activeChain, setActiveChain] = useState<{ id: number; name: string } | null>(null)
  const [supportedChainIds, setSupportedChainIds] = useState<number[]>([])

  // Load active chain configuration
  useEffect(() => {
    const loadActiveChain = async () => {
      const chain = await getActiveChain()
      setActiveChain(chain)
      setState(prev => ({
        ...prev,
        targetChainId: chain.id,
        targetChainName: chain.name,
      }))
    }
    loadActiveChain()
  }, [])

  // Load supported chain IDs
  useEffect(() => {
    const loadSupportedChains = async () => {
      const chainIds = await getSupportedChainIds()
      setSupportedChainIds(chainIds)
    }
    loadSupportedChains()
  }, [])

  // Listen for chain changes directly from window.ethereum
  useEffect(() => {
    if (!activeChain) return

    const handleChainChanged = async (chainId: string) => {
      const newChainId = parseInt(chainId, 16)
      console.log('[useNetworkSwitch] chain changed event', { newChainId, required: activeChain.id })
      
      // 🎯 MULTI-CHAIN: Check if user switched to a supported chain
      if (supportedChainIds.includes(newChainId)) {
        try {
          // Map chainId to chainName and switch active chain config
          const chainName = await configLoader.mapChainIdToName(newChainId)
          if (chainName) {
            console.log(`🔄 Switching to supported chain: ${chainName} (${newChainId})`)
            configLoader.setActiveChain(chainName)
            
            // Update active chain state to reflect the new chain
            const newActiveChain = await getActiveChain()
            setActiveChain(newActiveChain)
            
            setState(prev => ({
              ...prev,
              currentChainId: newChainId,
              targetChainId: newChainId,
              targetChainName: newActiveChain.name,
              isWrongNetwork: false,
              isUnsupportedNetwork: false,
            }))
            
            console.log(`✅ Successfully switched to ${chainName}`)
            return
          }
        } catch (error) {
          console.error('Failed to switch chain config:', error)
        }
      }
      
      // Fallback: Handle as wrong/unsupported network
      setState(prev => ({
        ...prev,
        currentChainId: newChainId,
        isWrongNetwork: newChainId !== activeChain.id,
        isUnsupportedNetwork: !supportedChainIds.includes(newChainId),
      }))
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', handleChainChanged)
      
      return () => {
        (window as any).ethereum?.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [activeChain, supportedChainIds])

  // Check if user is on wrong network
  useEffect(() => {
    if (!activeChain) return

    const actualChainId = getActualChainId(fallbackChainId, walletClient)
    
    if (isConnected && actualChainId) {
      const isWrongNetwork = actualChainId !== activeChain.id
      const isUnsupportedNetwork = !supportedChainIds.includes(actualChainId)
      
      console.log('[useNetworkSwitch] network check', {
        actual: actualChainId,
        required: activeChain.id,
        isWrongNetwork,
        isUnsupportedNetwork,
        supportedChains: supportedChainIds,
      })
      
      setState(prev => ({
        ...prev,
        isWrongNetwork,
        isUnsupportedNetwork,
        currentChainId: actualChainId,
      }))
    } else {
      setState(prev => ({
        ...prev,
        isWrongNetwork: false,
        isUnsupportedNetwork: false,
        currentChainId: undefined,
      }))
    }
  }, [isConnected, fallbackChainId, walletClient, activeChain, supportedChainIds])

  const getNetworkName = (chainId: number): string => {
    return chainId === activeChain?.id ? activeChain.name : 'Unsupported Network'
  }

  // CONSOLIDATED: Get available chains using centralized config system
  const getAvailableChains = async () => {
    try {
      const chainsConfig = await configLoader.loadChainsConfig()
      const supportedChains = chainsConfig.supportedChains || []
      
      const chains = []
      for (const chainName of supportedChains) {
        try {
          const chainData = await configLoader.loadChainConfig(chainName)
          chains.push({
            id: chainData.chainId,
            name: chainData.name,
            icon: `/tokens/${chainData.ticker.toLowerCase()}.png`, // Dynamic icon based on ticker
          })
        } catch (error) {
          console.warn(`Failed to load chain config for ${chainName}:`, error)
        }
      }
      
      return chains
    } catch (error) {
      console.error('Failed to load available chains:', error)
      return []
    }
  }

  // Network switching function
  const handleSwitchNetwork = async (chainId: number) => {
    if (!isConnected) {
      // If not connected, just open modal to show available chains
      setState(prev => ({ ...prev, isModalOpen: true }))
      return
    }

    try {
      setState(prev => ({ ...prev, isSwitching: true, switchError: null }))
      await switchChain({ chainId })
      setState(prev => ({ ...prev, isModalOpen: false }))
    } catch (error) {
      console.error('Failed to switch network:', error)
      setState(prev => ({ 
        ...prev, 
        switchError: error instanceof Error ? error.message : 'Failed to switch network' 
      }))
    } finally {
      setState(prev => ({ ...prev, isSwitching: false }))
    }
  }

  // Modal controls
  const openModal = () => setState(prev => ({ ...prev, isModalOpen: true }))
  const closeModal = () => setState(prev => ({ ...prev, isModalOpen: false }))

  return {
    ...state,
    currentNetworkName: state.currentChainId ? getNetworkName(state.currentChainId) : 'Unknown',
    targetNetworkName: state.targetChainName,
    handleSwitchNetwork,
    openModal,
    closeModal,
    getAvailableChains,
    isSwitching: state.isSwitching || isSwitching,
    switchError: state.switchError || (switchError?.message || null),
  }
} 