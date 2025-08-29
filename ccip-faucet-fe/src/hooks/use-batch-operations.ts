import { getFaucetSnapshot, getFaucetSnapshotFresh } from '@/lib/faucetClient'
import { useFaucetStore } from '@/store/faucet-store'
import { formatEther } from 'viem'
import { useCallback } from 'react'

/**
 * Lightweight replacement for the old batch-operations hook.
 * Only the functionality that is still referenced by live code is implemented.
 */
export function useBatchOperations() {
  const { updateTokenState, updateVaultBalance } = useFaucetStore()

  /**
   * Refresh both token tanks and vault balances in one RPC call.
   * Uses the same getFaucetSnapshot helper already leveraged elsewhere.
   */
  const fetchAllFaucetData = useCallback(async () => {
    try {
      const snap = await getFaucetSnapshot()

      // Tank pools & drip rates are handled by use-faucet → we only need vaults here
      const vaultActiveNum  = Number(formatEther(snap.treasury.active))  // Generic: was 'vaultMonNum'
      const vaultLinkNum = Number(formatEther(snap.treasury.link))

      updateVaultBalance('active', vaultActiveNum) // Changed from 'mon' to 'active'
      updateVaultBalance('link', vaultLinkNum)
    } catch (err) {
      console.error('fetchAllFaucetData failed', err)
    }
  }, [updateVaultBalance])

  /**
   * Fresh version that bypasses cache for manual refresh operations.
   * Gets the latest data directly from the blockchain.
   */
  const fetchAllFaucetDataFresh = useCallback(async () => {
    try {
      const snap = await getFaucetSnapshotFresh()

      // Tank pools & drip rates are handled by use-faucet → we only need vaults here
      const vaultActiveNum  = Number(formatEther(snap.treasury.active))  // Generic: was 'vaultMonNum'
      const vaultLinkNum = Number(formatEther(snap.treasury.link))

      updateVaultBalance('active', vaultActiveNum) // Changed from 'mon' to 'active'
      updateVaultBalance('link', vaultLinkNum)
    } catch (err) {
      console.error('fetchAllFaucetDataFresh failed', err)
    }
  }, [updateVaultBalance])

  /**
   * Check contract state including refillInProgress flag
   */
  const batchContractStateCheck = useCallback(async () => {
    try {
      const faucetAddress = await getFaucetAddress()
      const refillInProgress = await publicClient.readContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,
        functionName: 'refillInProgress',
      }) as boolean

      return {
        refillInProgress,
      }
    } catch (err) {
      console.error('batchContractStateCheck failed', err)
      return null
    }
  }, [])

  // Return exactly the API still used by runtime code
  return {
    fetchAllFaucetData,
    fetchAllFaucetDataFresh, // New fresh version for refresh button
    batchContractStateCheck,
  }
} 