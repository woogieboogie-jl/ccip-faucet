import { useState, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { getActiveChain } from '@/lib/config'

// CONSOLIDATION: NetworkSwitchState is specific to this hook only, so keeping it local
// If this interface is used elsewhere, it should be moved to types.ts
interface NetworkSwitchState {
  isWrongNetwork: boolean
  currentChainId: number | undefined
  targetChainId: number
  targetChainName: string
  isSwitching: boolean
  switchError: string | null
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

export function useNetworkSwitch() {
  const { isConnected } = useAccount()
  const fallbackChainId = useChainId()
  const { data: walletClient } = useWalletClient({})
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()
  
  const [state, setState] = useState<NetworkSwitchState>({
    isWrongNetwork: false,
    currentChainId: undefined,
    targetChainId: 0,
    targetChainName: '',
    isSwitching: false,
    switchError: null,
  })

  const [activeChain, setActiveChain] = useState<{ id: number; name: string } | null>(null)

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

  // Listen for chain changes directly from window.ethereum
  useEffect(() => {
    if (!activeChain) return

    const handleChainChanged = (chainId: string) => {
      const newChainId = parseInt(chainId, 16)
      console.log('[useNetworkSwitch] chain changed event', { newChainId, required: activeChain.id })
      
      setState(prev => ({
        ...prev,
        currentChainId: newChainId,
        isWrongNetwork: newChainId !== activeChain.id,
      }))
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', handleChainChanged)
      
      return () => {
        (window as any).ethereum?.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [activeChain])

  // Check if user is on wrong network
  useEffect(() => {
    if (!activeChain) return

    const actualChainId = getActualChainId(fallbackChainId, walletClient)
    
    if (isConnected && actualChainId) {
      const isWrongNetwork = actualChainId !== activeChain.id
      
      console.log('[useNetworkSwitch] network check', {
        actual: actualChainId,
        required: activeChain.id,
        isWrongNetwork,
      })
      
      setState(prev => ({
        ...prev,
        isWrongNetwork,
        currentChainId: actualChainId,
      }))
    } else {
      setState(prev => ({
        ...prev,
        isWrongNetwork: false,
        currentChainId: undefined,
      }))
    }
  }, [isConnected, fallbackChainId, walletClient, activeChain])

  const getNetworkName = (chainId: number): string => {
    return chainId === activeChain?.id ? activeChain.name : 'Unsupported Network'
  }

  // Network switching function
  const handleSwitchNetwork = async () => {
    if (!activeChain || isSwitching) return
    
    try {
      setState(prev => ({ ...prev, isSwitching: true, switchError: null }))
      await switchChain({ chainId: activeChain.id })
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

  return {
    ...state,
    currentNetworkName: state.currentChainId ? getNetworkName(state.currentChainId) : 'Unknown',
    targetNetworkName: state.targetChainName,
    handleSwitchNetwork,
    isSwitching: state.isSwitching || isSwitching,
    switchError: state.switchError || (switchError?.message || null),
  }
} 