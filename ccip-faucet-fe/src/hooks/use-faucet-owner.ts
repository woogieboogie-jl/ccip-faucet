import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { getFaucetAddress } from '@/lib/config/chain/addresses'
import { createConfigDrivenPublicClient } from '@/lib/config/chain/viem-client'
import { cachedContractRead } from '@/lib/request-cache'

// Faucet contract owner function ABI
const ownerAbi = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

export function useFaucetOwner() {
  const [faucetOwner, setFaucetOwner] = useState<string | null>(null)
  const [isOwnerLoading, setIsOwnerLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOwner = async () => {
      try {
        setIsOwnerLoading(true)
        setError(null)

        // Use consolidated configurable pipeline
        const faucetAddress = await getFaucetAddress()
        const publicClient = await createConfigDrivenPublicClient()

        // Use cached contract read for efficiency
        const owner = await cachedContractRead(
          'faucetOwner',
          () => publicClient.readContract({
            address: faucetAddress as `0x${string}`,
            abi: ownerAbi,
            functionName: 'owner',
          }) as Promise<`0x${string}`>,
          [],
          5 * 60 * 1000 // 5 minutes cache for owner address
        )

        setFaucetOwner(owner)
        console.log('✅ Faucet owner fetched:', owner)
      } catch (err) {
        console.error('❌ Failed to fetch faucet owner:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch owner')
        setFaucetOwner(null)
      } finally {
        setIsOwnerLoading(false)
      }
    }

    fetchOwner()
  }, [])

  return {
    faucetOwner,
    isOwnerLoading,
    error,
  }
} 