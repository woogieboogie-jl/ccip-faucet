

import { useState } from 'react'
import { encodeFunctionData, parseAbi } from 'viem'
import { useWalletClient } from 'wagmi'
import { getSmartAccountClient } from '@/lib/aa-client'
import { getFaucetAddress } from '@/lib/config'

export function useAccountAbstraction() {
  const [isProcessing, setIsProcessing] = useState(false)
  const { data: walletClient } = useWalletClient()

  const executeGaslessTransaction = async (
    recipientAddress?: `0x${string}`,
    faucetAddress?: `0x${string}`,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!walletClient) return { success: false, error: 'Wallet not connected' }

    try {
      setIsProcessing(true)

      // Build a SmartAccountClient for this wallet
      const sac = await getSmartAccountClient(walletClient)

      // Get faucet address from config if not provided
      const finalFaucetAddress = faucetAddress ?? (await getFaucetAddress()) as `0x${string}`

      // IMPORTANT: Use the EOA address (recipientAddress) as the recipient, not the smart account address
      const finalRecipient = recipientAddress ?? walletClient.account.address
      
      console.log('AA Transaction Details:')
      console.log('- EOA Address (walletClient):', walletClient.account.address)
      console.log('- Smart Account Address:', sac.account.address)
      console.log('- Final Recipient (tokens go to):', finalRecipient)
      console.log('- Faucet Address:', finalFaucetAddress)

      // Send the faucet call via a sponsored UserOperation
      const faucetAbi = parseAbi(['function requestNativeTokensTo(address)'])

      const txHash = await sac.sendTransaction({
        to: finalFaucetAddress,
        data: encodeFunctionData({
          abi: faucetAbi,
          functionName: 'requestNativeTokensTo',
          args: [finalRecipient], // This MUST be the EOA address
        }),
        value: 0n,
      })

      console.log('AA Transaction Hash:', txHash)
      return { success: true, txHash }
    } catch (error: any) {
      console.error('AA Transaction failed:', error)
      return { success: false, error: error?.message ?? 'Unknown error' }
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    executeGaslessTransaction,
    isProcessing,
  }
}
