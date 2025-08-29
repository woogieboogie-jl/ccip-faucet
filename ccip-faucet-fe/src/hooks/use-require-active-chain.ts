import { useChainId, useWalletClient } from 'wagmi'
import { configLoader } from '@/lib/config'
import { useState, useEffect } from 'react'

/**
 * useRequireActiveChain
 *
 * Returns a function that checks if the wallet is connected to any supported chain.
 * CONSOLIDATION: Now uses multi-chain validation instead of single-chain check.
 * This fixes "Wrong Network" buttons appearing on supported chains.
 *
 * Usage:
 *   const requireActiveChain = useRequireActiveChain();
 *   const isCorrectNetwork = requireActiveChain();
 */
export function useRequireActiveChain() {
  const fallbackChainId = useChainId()
  const { data: walletClient } = useWalletClient({})
  const [supportedChainIds, setSupportedChainIds] = useState<number[]>([])

  useEffect(() => {
    const loadSupportedChains = async () => {
      try {
        // CONSOLIDATION: Use ConfigLoader's centralized getSupportedChainIds method
        const chainIds = await configLoader.getSupportedChainIds()
        setSupportedChainIds(chainIds)
        console.log('🔗 useRequireActiveChain: Loaded supported chain IDs:', chainIds)
      } catch (error) {
        console.error('Failed to load supported chain IDs:', error)
        setSupportedChainIds([])
      }
    }
    
    loadSupportedChains()
    
    // CONSOLIDATION FIX: Listen for chain changes to reload supported chains
    // This ensures we have fresh chain IDs after chain switches
    const handleChainChange = () => {
      console.log('🔄 useRequireActiveChain: Chain changed, reloading supported chains...')
      setTimeout(() => {
        loadSupportedChains() // Reload with slight delay to ensure config is updated
      }, 100)
    }
    
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', handleChainChange)
      
      return () => {
        (window as any).ethereum?.removeListener('chainChanged', handleChainChange)
      }
    }
  }, [])

  return () => {
    if (supportedChainIds.length === 0) {
      return false
    }

    // Get the actual wallet chain ID directly from window.ethereum
    const windowChainId = typeof window !== 'undefined' && (window as any).ethereum?.chainId 
      ? parseInt((window as any).ethereum.chainId, 16) 
      : undefined

    // Use window.ethereum.chainId as primary source since it's the only reliable way
    // to detect when wallet is on unsupported chains. Wagmi normalizes unsupported chains
    // to the first configured chain, which is misleading.
    const actualChainId = windowChainId ?? walletClient?.chain?.id ?? fallbackChainId

    console.log('[useRequireActiveChain] multi-chain validation', { 
      actual: actualChainId,
      supportedChains: supportedChainIds,
      isSupported: actualChainId ? supportedChainIds.includes(actualChainId) : false,
      source: windowChainId ? 'window.ethereum' : 'wagmi'
    })

    // CONSOLIDATION: Return true if on ANY supported network, false otherwise
    return actualChainId != null && supportedChainIds.includes(actualChainId)
  }
}