// New aggregated faucet client for minimal RPC usage
import { parseAbi, type Abi } from 'viem'
import { getFaucetAddress } from './config/chain/addresses'
import { createConfigDrivenPublicClient } from './config/chain/viem-client'
import { cachedContractRead } from './request-cache'
import { faucetAbi } from './faucetAbi'  // Use the generic ABI

// Lazy loading pattern for faucet address and client
let cachedFaucetAddress: string | null = null
let cachedPublicClient: any = null

async function getCachedFaucetAddress(): Promise<string> {
  if (cachedFaucetAddress) return cachedFaucetAddress
  cachedFaucetAddress = await getFaucetAddress()
  return cachedFaucetAddress
}

async function getCachedPublicClient() {
  if (cachedPublicClient) return cachedPublicClient
  cachedPublicClient = await createConfigDrivenPublicClient()
  return cachedPublicClient
}

/**
 * Clear cached faucet address and RPC client (called during chain switches)
 * This ensures fresh address resolution and RPC client for the new chain
 */
export function clearFaucetClientCache(): void {
  console.log('🧹 Clearing faucet client cache (address + RPC client) for chain switch')
  cachedFaucetAddress = null
  cachedPublicClient = null
}

export interface FaucetSnapshot {
  active: { pool: bigint; drip: bigint; baseDrip: bigint; capacity: bigint }  // Generic: was 'mon'
  link: { pool: bigint; drip: bigint; baseDrip: bigint; capacity: bigint }
  treasury: { active: bigint; link: bigint }  // Generic: was 'mon'
  constants: { cooldown: number; thresholdFactor: number }
  lastClaim?: { active: bigint; link: bigint }  // Generic: was 'mon'
}

/**
 * Aggregate every read we need into a single RPC round-trip (3 ‑> 1).
 * Pass the current user address if you need cooldown data.
 * NOW WITH CACHING: Prevents duplicate calls within 30 seconds
 */
export async function getFaucetSnapshot(user?: `0x${string}`): Promise<FaucetSnapshot> {
  const faucetAddress = await getCachedFaucetAddress()
  const publicClient = await getCachedPublicClient()
  
  // Use cached contract reads with different TTL based on data type
  const calls: Promise<any>[] = [
    // Tank data changes more frequently - shorter cache (30s)
    cachedContractRead(
      'getReservoirStatus',
      () => publicClient.readContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,
        functionName: 'getReservoirStatus',
      }),
      [],
      30 * 1000 // 30 seconds
    ),
    
    // Treasury data changes less frequently - longer cache (60s)
    cachedContractRead(
      'getTreasuryStatus',
      () => publicClient.readContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,
        functionName: 'getTreasuryStatus',
      }),
      [],
      60 * 1000 // 60 seconds
    ),
    
    // Constants never change - very long cache (5 minutes)
    cachedContractRead(
      'COOLDOWN',
      () => publicClient.readContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,
        functionName: 'COOLDOWN',
      }),
      [],
      5 * 60 * 1000 // 5 minutes
    ),
    
    cachedContractRead(
      'thresholdFactor',
      () => publicClient.readContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,
        functionName: 'thresholdFactor',
      }),
      [],
      5 * 60 * 1000 // 5 minutes
    ),
    
    // Base drip rates never change - very long cache (10 minutes)
    // GRACEFUL FALLBACK: Handle old contracts that don't have these functions
    cachedContractRead(
      'BASENATIVEDRIPRATE',
      () => publicClient.readContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,
        functionName: 'BASENATIVEDRIPRATE',
      }).catch(() => 0n), // Fallback to 0 if function doesn't exist
      [],
      10 * 60 * 1000 // 10 minutes
    ),
    
    cachedContractRead(
      'BASELINKDRIPRATE',
      () => publicClient.readContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,
        functionName: 'BASELINKDRIPRATE',
      }).catch(() => 0n), // Fallback to 0 if function doesn't exist
      [],
      10 * 60 * 1000 // 10 minutes
    ),
  ]

  // Add user-specific cooldown data if address provided
  if (user) {
    calls.push(
      cachedContractRead(
        'lastClaimNative',
        () => publicClient.readContract({
          address: faucetAddress as `0x${string}`,
          abi: faucetAbi,
          functionName: 'lastClaimNative',
          args: [user],
        }),
        [user],
        30 * 1000 // 30 seconds
      ),
      cachedContractRead(
        'lastClaimLink',
        () => publicClient.readContract({
          address: faucetAddress as `0x${string}`,
          abi: faucetAbi,
          functionName: 'lastClaimLink',
          args: [user],
        }),
        [user],
        30 * 1000 // 30 seconds
      )
    )
  }

  const [
    reservoirStatus,
    treasuryStatus,
    cooldown,
    thresholdFactor,
    baseNativeDrip,
    baseLinkDrip,
    ...userData
  ] = await Promise.all(calls)

  return {
    active: {
      pool: reservoirStatus[0],        // ✅ TANK: Dispensable reservoir pool for dripping
      drip: reservoirStatus[1],
      baseDrip: baseNativeDrip,
      capacity: treasuryStatus[4],     // Max reservoir capacity
    },
    link: {
      pool: reservoirStatus[2],        // ✅ TANK: Dispensable reservoir pool for dripping  
      drip: reservoirStatus[3],
      baseDrip: baseLinkDrip,
      capacity: treasuryStatus[5],     // Max reservoir capacity
    },
    treasury: {
      active: treasuryStatus[0],       // ✅ VAULT: Treasury balance (total - reservoir)
      link: treasuryStatus[2],         // ✅ VAULT: Treasury balance (total - reservoir)
    },
    constants: {
      cooldown: Number(cooldown),
      thresholdFactor: Number(thresholdFactor),
    },
    lastClaim: user ? {
      active: userData[0],
      link: userData[1],
    } : undefined,
  }
}

/**
 * Non-cached version of getFaucetSnapshot for refresh operations.
 * Bypasses all caching to get fresh data from the blockchain.
 */
export async function getFaucetSnapshotFresh(user?: `0x${string}`): Promise<FaucetSnapshot> {
  const faucetAddress = await getCachedFaucetAddress()
  const publicClient = await getCachedPublicClient()
  
  // Direct contract calls without caching
  const calls: Promise<any>[] = [
    // Tank data
    publicClient.readContract({
      address: faucetAddress as `0x${string}`,
      abi: faucetAbi,
      functionName: 'getReservoirStatus',
    }),
    
    // Treasury data
    publicClient.readContract({
      address: faucetAddress as `0x${string}`,
      abi: faucetAbi,
      functionName: 'getTreasuryStatus',
    }),
    
    // Constants
    publicClient.readContract({
      address: faucetAddress as `0x${string}`,
      abi: faucetAbi,
      functionName: 'COOLDOWN',
    }),
    
    publicClient.readContract({
      address: faucetAddress as `0x${string}`,
      abi: faucetAbi,
      functionName: 'thresholdFactor',
    }),
    
    // Base drip rates with fallback
    publicClient.readContract({
      address: faucetAddress as `0x${string}`,
      abi: faucetAbi,
      functionName: 'BASENATIVEDRIPRATE',
    }).catch(() => 0n),
    
    publicClient.readContract({
      address: faucetAddress as `0x${string}`,
      abi: faucetAbi,
      functionName: 'BASELINKDRIPRATE',
    }).catch(() => 0n),
  ]

  // Add user-specific cooldown data if address provided
  if (user) {
    calls.push(
      publicClient.readContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,
        functionName: 'lastClaimNative',
        args: [user],
      }),
      publicClient.readContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,
        functionName: 'lastClaimLink',
        args: [user],
      })
    )
  }

  const [
    reservoirStatus,
    treasuryStatus,
    cooldown,
    thresholdFactor,
    baseMonDrip,
    baseLinkDrip,
    ...userData
  ] = await Promise.all(calls)

  return {
    active: {
      pool: reservoirStatus[0],        // ✅ TANK: Dispensable reservoir pool for dripping
      drip: reservoirStatus[1],
      baseDrip: baseMonDrip,
      capacity: treasuryStatus[4],     // Max reservoir capacity
    },
    link: {
      pool: reservoirStatus[2],        // ✅ TANK: Dispensable reservoir pool for dripping
      drip: reservoirStatus[3],
      baseDrip: baseLinkDrip,
      capacity: treasuryStatus[5],     // Max reservoir capacity
    },
    treasury: {
      active: treasuryStatus[0],       // ✅ VAULT: Treasury balance (total - reservoir)
      link: treasuryStatus[2],         // ✅ VAULT: Treasury balance (total - reservoir)
    },
    constants: {
      cooldown: Number(cooldown),
      thresholdFactor: Number(thresholdFactor),
    },
    lastClaim: user ? {
      active: userData[0],
      link: userData[1],
    } : undefined,
  }
} 