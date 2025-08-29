

import { useState, useEffect } from "react"
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { WalletState } from '@/lib/types'
import { formatEther, parseAbi } from 'viem'
import { createConfigDrivenPublicClient, getAddresses } from '@/lib/config'
import { cachedContractRead } from '@/lib/request-cache'
import { configService } from '@/lib/config'

export function useWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()

  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    isOwner: false,
    nativeBalance: 0,
    linkBalance: 0,
  })

  // 🆕 Track chain changes for balance refresh
  const [chainName, setChainName] = useState<string>('')

  // Load current chain name and listen for changes
  useEffect(() => {
    const loadChainName = async () => {
      try {
        const config = await configService.getActiveChainConfig()
        setChainName(config?.name || '')
        console.log('👛 useWallet: Chain loaded:', config?.name)
      } catch (error) {
        console.warn('👛 useWallet: Failed to load chain name:', error)
      }
    }
    loadChainName()

    // REMOVED: Chain change listener - now handled centrally by setActiveChain()
    // Chain name updates are handled by the consolidated pipeline
  }, [])

  // Fetch real balances from blockchain
  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !isConnected) {
        setWallet(prev => ({
          ...prev,
          nativeBalance: 0,
          linkBalance: 0,
        }))
        return
      }

      try {
        const addresses = await getAddresses()
        const publicClient = await createConfigDrivenPublicClient()

        // Use cached contract reads for user balances
        const [nativeBalanceRaw, linkBalanceRaw] = await Promise.all([
          cachedContractRead(
            'userNativeBalance',
            () => publicClient.getBalance({ address }),
            [address],
            30 * 1000 // 30 seconds cache for user balances
          ),
          addresses.ACTIVE_CHAIN_LINK_TOKEN ? cachedContractRead(
            'userLinkBalance',
            () => publicClient.readContract({
              address: addresses.ACTIVE_CHAIN_LINK_TOKEN as `0x${string}`,
              abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
              functionName: 'balanceOf',
              args: [address],
            }) as Promise<bigint>,
            [address],
            30 * 1000 // 30 seconds cache for user balances
          ) : Promise.resolve(0n)
        ])

        setWallet(prev => ({
          ...prev,
          nativeBalance: Number(formatEther(nativeBalanceRaw)),
          linkBalance: Number(formatEther(linkBalanceRaw)),
        }))
      } catch (error) {
        console.error('Failed to fetch wallet balances:', error)
        setWallet(prev => ({
          ...prev,
          nativeBalance: 0,
          linkBalance: 0,
        }))
      }
    }

    fetchBalances()

    // Refresh balances every 60 seconds
    const interval = setInterval(fetchBalances, 60000)
    return () => clearInterval(interval)
  }, [address, isConnected, chainName]) // 🆕 Re-fetch when chain changes

  const connectWallet = async () => {
    try {
      // Use the first available connector
      const connector = connectors[0]
      if (connector) {
        await connect({ connector })
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  const disconnectWallet = () => {
    disconnect()
    setWallet({
      address: null,
      isConnected: false,
      isOwner: false,
      nativeBalance: 0,
      linkBalance: 0,
    })
  }

  const updateNativeBalance = (newBalance: number) => {
    setWallet((prev) => ({ ...prev, nativeBalance: newBalance }))
  }

  const truncateAddress = (address: string) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return {
    wallet,
    isConnecting,
    connectWallet,
    disconnectWallet,
    updateNativeBalance,
    truncateAddress,
  }
}
