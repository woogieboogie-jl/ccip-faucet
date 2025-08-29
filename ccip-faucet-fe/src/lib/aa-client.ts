import { createSmartAccountClient } from 'permissionless'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { createPublicClient, http } from 'viem'
// CONSOLIDATED: Use main config system instead of legacy chain-config
import { getActiveChain, getChainConstants } from '@/lib/config'

// CONSOLIDATION: Pimlico client is now created dynamically per chain
// This enables multi-chain gas-free transactions

// Factory that returns a ready SmartAccountClient for a connected wallet
export async function getSmartAccountClient(walletClient: any /* wagmi WalletClient */) {
  // CONSOLIDATION: Get both chain and AA config from consolidated system
  const activeChain = await getActiveChain()
  const { AA_CONFIG } = await getChainConstants()
  
  console.log('🔧 AA Client: Using consolidated config for', activeChain.name)
  console.log('   📍 Bundler URL:', AA_CONFIG.bundlerUrl)
  console.log('   📍 Entry Point:', AA_CONFIG.entryPointAddress)
  console.log('   📍 Factory:', AA_CONFIG.factoryAddress)
  
  // CONSOLIDATION: Create chain-specific Pimlico client using config
  const pimlicoClient = createPimlicoClient({
    transport: http(AA_CONFIG.bundlerUrl),
    entryPoint: {
      address: AA_CONFIG.entryPointAddress as `0x${string}`,
      version: '0.7',
    },
  })
  
  // Create config-driven public client
  const publicClient = createPublicClient({
    chain: activeChain,
    transport: http(activeChain.rpcUrls.default.http[0]),
  })

  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner: walletClient,
    entryPoint: { 
      address: AA_CONFIG.entryPointAddress as `0x${string}`, 
      version: '0.7' 
    },
  })

  return createSmartAccountClient({
    account,
    chain: activeChain,
    bundlerTransport: http(AA_CONFIG.bundlerUrl),
    paymaster: pimlicoClient,
    // signer already attached in SimpleSmartAccount
    paymasterContext: {
      sponsorshipPolicyId: import.meta.env.VITE_POLICY_ID,
    },
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  })
} 