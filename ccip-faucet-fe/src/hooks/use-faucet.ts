import { useState, useEffect, useCallback } from 'react'
import { parseAbi, encodeFunctionData, formatEther } from "viem"
import { useWalletClient, usePublicClient } from 'wagmi'
import { getFaucetSnapshot } from '@/lib/faucetClient'
import { publicClient } from '@/lib/viem'
import { useAutoCooldownManager } from '@/hooks/use-cooldown-manager'
import { faucetAbi } from '@/lib/faucetAbi'  // Use centralized ABI
import { useFaucetStore, useTokenState, useVaultState, useVolatilityState } from '@/store/faucet-store'
import { useBatchOperations } from '@/hooks/use-batch-operations'
import { useRequireActiveChain } from '@/hooks/use-require-active-chain'
import { getFaucetAddress, getLinkTokenAddress } from '@/lib/config/chain/addresses'

interface TokenState {
  tankBalance: number // Per-asset tank (available for dripping)
  maxTankBalance: number // Max tank capacity per asset
  baseDripAmount: number // Base drip amount before volatility adjustment
  currentDripAmount: number // Current drip amount (adjusted by volatility)
  dripCooldownTime: number
  requestCooldownTime: number // Cooldown for fuel button (cross-chain request)
  isDripLoading: boolean
  isRequestLoading: boolean
  contractAddress: string
  lowTankThreshold: number // When to show fuel button
}

interface FaucetState {
  active: TokenState  // Changed from 'mon' to 'active'
  link: TokenState
  vaultActive: number // Changed from 'vaultMon' to 'vaultActive'
  vaultLink: number // LINK vault reserves
}

interface GlobalVolatilityState {
  multiplier: number
  lastUpdated: Date
  isUpdating: boolean
}

export function useFaucet() {
  // CONSOLIDATION: Read from Zustand store instead of maintaining local state
  const activeTokenState = useTokenState('active') // Changed from 'mon' to 'active'
  const linkTokenState = useTokenState('link')
  const vaultBalances = useVaultState()
  const volatilityState = useVolatilityState()
  
  // CONSOLIDATION: Use existing network validation infrastructure
  const requireActiveChain = useRequireActiveChain()
  
  // Create the faucet object from Zustand store data to maintain API compatibility
  const faucet: FaucetState & { globalVolatility: GlobalVolatilityState } = {
    active: {  // Changed from 'mon' to 'active'
      tankBalance: activeTokenState.tankBalance,
      maxTankBalance: activeTokenState.maxTankBalance,
      baseDripAmount: activeTokenState.baseDripAmount,
      currentDripAmount: activeTokenState.currentDripAmount,
      dripCooldownTime: activeTokenState.dripCooldownTime,
      requestCooldownTime: activeTokenState.requestCooldownTime,
      isDripLoading: activeTokenState.isDripLoading,
      isRequestLoading: activeTokenState.isRequestLoading,
      contractAddress: activeTokenState.contractAddress,
      lowTankThreshold: activeTokenState.lowTankThreshold,
    },
    link: {
      tankBalance: linkTokenState.tankBalance,
      maxTankBalance: linkTokenState.maxTankBalance,
      baseDripAmount: linkTokenState.baseDripAmount,
      currentDripAmount: linkTokenState.currentDripAmount,
      dripCooldownTime: linkTokenState.dripCooldownTime,
      requestCooldownTime: linkTokenState.requestCooldownTime,
      isDripLoading: linkTokenState.isDripLoading,
      isRequestLoading: linkTokenState.isRequestLoading,
      contractAddress: linkTokenState.contractAddress,
      lowTankThreshold: linkTokenState.lowTankThreshold,
    },
    vaultActive: vaultBalances.active, // Changed from 'vaultMon' to 'vaultActive'
    vaultLink: vaultBalances.link,
    globalVolatility: {
      multiplier: volatilityState.multiplier,
      lastUpdated: volatilityState.lastUpdated,
      isUpdating: volatilityState.isUpdating,
    },
  }

  const { data: walletClient } = useWalletClient()
  const { setDripCooldown } = useAutoCooldownManager()
  const { fetchAllFaucetData } = useBatchOperations()
  const { updateTokenState, updateVolatility } = useFaucetStore()

  // REMOVED: Local state and sync effects - now reading directly from Zustand

  // Unified snapshot fetch - now updates Zustand store directly
  const refreshSnapshot = async (account?: `0x${string}`) => {
    console.log('📊 [DEBUG] refreshSnapshot: Starting contract data fetch')
    console.log('   → Account:', account)
    console.log('   → Timestamp:', new Date().toISOString())
    
    try {
      console.log('   → Calling getFaucetSnapshot...')
      const snap = await getFaucetSnapshot(account)
      console.log('   → getFaucetSnapshot succeeded, processing data...')

      const activePoolNum  = Number(formatEther(snap.active.pool))
      const activeDripNum  = Number(formatEther(snap.active.drip))
      const linkPoolNum = Number(formatEther(snap.link.pool))
      const linkDripNum = Number(formatEther(snap.link.drip))

      // New: derive on-chain reservoir capacities for accurate UI max values
      const activeCapNum  = Number(formatEther(snap.active.capacity))
      const linkCapNum = Number(formatEther(snap.link.capacity))

      // CRITICAL FIX: Fetch base drip amounts and thresholds from contract
      const activeBaseDripNum = Number(formatEther(snap.active.baseDrip))
      const linkBaseDripNum = Number(formatEther(snap.link.baseDrip))
      
      // Calculate low tank threshold based on contract thresholdFactor
      const thresholdFactor = snap.constants.thresholdFactor
      const activeLowThreshold = activeDripNum * thresholdFactor
      const linkLowThreshold = linkDripNum * thresholdFactor

      // CRITICAL FIX: Calculate remaining cooldown time from contract data
      const contractCooldown = snap.constants.cooldown
      let activeRemainingCooldown = 0
      let linkRemainingCooldown = 0
      
      // Get current cooldown state from Zustand store
      const currentState = useFaucetStore.getState()
      const currentActiveCooldown = currentState.tokens.active.dripCooldownTime
      const currentLinkCooldown = currentState.tokens.link.dripCooldownTime
      
      if (account && snap.lastClaim) {
        const now = Math.floor(Date.now() / 1000) // Current timestamp in seconds
        const activeLastClaim = Number(snap.lastClaim.active)
        const linkLastClaim = Number(snap.lastClaim.link)
        
        // Only recalculate cooldown if there's no active cooldown in Zustand
        // This prevents overwriting existing cooldown state during data refreshes
        if (currentActiveCooldown <= 0) {
          activeRemainingCooldown = Math.max(0, contractCooldown - (now - activeLastClaim))
        } else {
          activeRemainingCooldown = currentActiveCooldown
        }
        
        if (currentLinkCooldown <= 0) {
          linkRemainingCooldown = Math.max(0, contractCooldown - (now - linkLastClaim))
        } else {
          linkRemainingCooldown = currentLinkCooldown
        }
        
        console.log(`⏱️ Cooldown calculation for ${account}:`, {
          contractCooldown,
          now,
          activeLastClaim,
          linkLastClaim,
          currentActiveCooldown,
          currentLinkCooldown,
          activeRemainingCooldown,
          linkRemainingCooldown,
          preservedActive: currentActiveCooldown > 0,
          preservedLink: currentLinkCooldown > 0,
        })
      }

      // Update Zustand store with fresh data including base amounts, thresholds, and cooldowns
      console.log('   → Updating Zustand store with contract data:')
      console.log('     • Active:', { tankBalance: activePoolNum, currentDripAmount: activeDripNum, maxTankBalance: activeCapNum })
      console.log('     • Link:', { tankBalance: linkPoolNum, currentDripAmount: linkDripNum, maxTankBalance: linkCapNum })
      
      updateTokenState('active', {
        tankBalance: activePoolNum,
        currentDripAmount: activeDripNum,
        maxTankBalance: activeCapNum,
        baseDripAmount: activeBaseDripNum,
        lowTankThreshold: activeLowThreshold,
        dripCooldownTime: activeRemainingCooldown,
      })
      
      updateTokenState('link', {
        tankBalance: linkPoolNum,
        currentDripAmount: linkDripNum,
        maxTankBalance: linkCapNum,
        baseDripAmount: linkBaseDripNum,
        lowTankThreshold: linkLowThreshold,
        dripCooldownTime: linkRemainingCooldown,
      })
      
      console.log('   → Zustand store updated successfully')

      // Update vault balances from treasury data
      const { updateVaultBalance } = useFaucetStore.getState()
      updateVaultBalance('active', Number(formatEther(snap.treasury.active)))
      updateVaultBalance('link', Number(formatEther(snap.treasury.link)))

      // Start cooldown timer if any cooldowns are active
      if (activeRemainingCooldown > 0 || linkRemainingCooldown > 0) {
        const { startCooldownTimer } = useFaucetStore.getState()
        startCooldownTimer()
      }

      console.log('🔄 Faucet snapshot refreshed:', {
        active: { 
          pool: activePoolNum, 
          drip: activeDripNum, 
          capacity: activeCapNum,
          baseDrip: activeBaseDripNum,
          lowThreshold: activeLowThreshold,
          cooldown: activeRemainingCooldown,
        },
        link: { 
          pool: linkPoolNum, 
          drip: linkDripNum, 
          capacity: linkCapNum,
          baseDrip: linkBaseDripNum,
          lowThreshold: linkLowThreshold,
          cooldown: linkRemainingCooldown,
        },
        treasury: snap.treasury,
        thresholdFactor,
        contractCooldown,
      })

    } catch (error) {
      console.error('❌ [DEBUG] Error refreshing faucet snapshot:', error)
      console.log('   → Error type:', error?.constructor?.name)
      console.log('   → Error message:', error?.message)
      console.log('   → Timestamp:', new Date().toISOString())
      
      // CONSOLIDATION: Set zero values when contract calls fail
      // This handles cases where network is correct but contract doesn't exist or has issues
      console.log('   → Setting zero values for tank balances and drip rates')
      
      updateTokenState('active', {
        tankBalance: 0,
        currentDripAmount: 0,
        maxTankBalance: 0,
        baseDripAmount: 0,
        lowTankThreshold: 0,
        dripCooldownTime: 0,
      })
      
      updateTokenState('link', {
        tankBalance: 0,
        currentDripAmount: 0,
        maxTankBalance: 0,
        baseDripAmount: 0,
        lowTankThreshold: 0,
        dripCooldownTime: 0,
      })
      
      // Also clear vault balances
      const { updateVaultBalance } = useFaucetStore.getState()
      updateVaultBalance('active', 0)
      updateVaultBalance('link', 0)
      
      console.log('   → Zero values set in Zustand store')
    }
  }

  // Snapshot refresh on mount only - removed walletClient dependency to prevent unnecessary refreshes
  useEffect(() => {
    console.log('🚀 [DEBUG] useFaucet: Mount effect triggered - calling initial refreshSnapshot')
    console.log('   → Wallet address:', walletClient?.account.address)
    console.log('   → Timestamp:', new Date().toISOString())
    refreshSnapshot(walletClient?.account.address as `0x${string}` | undefined)
  }, []) // Empty dependency array - only run on mount

  // (we no longer return early because faucet is always defined)

  // ------------------------------------------------------------
  // Drip tokens (on-chain call)
  // ------------------------------------------------------------
  const requireMonad = useRequireActiveChain()

  const dripTokens = async (tokenType: "active" | "link") => {  // Changed from "mon" | "link"
    if (!walletClient) {
      console.error('No wallet client')
      return
    }

    const tokenKey = tokenType // No need to map since we're using the correct keys now
    if (faucet[tokenType].dripCooldownTime > 0) return

    try {
      updateTokenState(tokenKey, { isDripLoading: true })

      // Use imported faucetAbi instead of hardcoded ABI
      const functionName = tokenType === "active" ? "requestNativeTokens" : "requestLinkTokens"
      const faucetAddress = await getFaucetAddress()
      const { request } = await publicClient.simulateContract({
        address: faucetAddress as `0x${string}`,
        abi: faucetAbi,  // Use imported ABI
        functionName,
        account: walletClient.account,
      })

      const txHash = await walletClient.writeContract(request)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      
      if (receipt.status === 'success') {
        updateTokenState(tokenKey, { isDripLoading: false })
        
        // FIXED: Get the actual contract cooldown duration instead of hardcoded value
        const snap = await getFaucetSnapshot(walletClient.account.address)
        const contractCooldown = snap.constants.cooldown // This is the actual COOLDOWN from contract
        
        console.log(`✅ Drip successful! Using contract cooldown: ${contractCooldown}s (${Math.floor(contractCooldown/60)} minutes)`)
        
        // OPTIMIZED: Use centralized cooldown system with correct contract duration
        setDripCooldown(tokenType, contractCooldown)
      }
    } catch (err) {
      console.error('Drip failed', err)
      updateTokenState(tokenKey, { isDripLoading: false })
    }
  }

  // Fuel button action: Cross-chain volatility check + vault→tank refill
  const requestVolatilityAndRefill = async (tokenType: "active" | "link") => {  // Changed from "mon" | "link"
    if (faucet[tokenType].requestCooldownTime > 0) return

    // CONSOLIDATION: Update Zustand store directly instead of local state
    const tokenKey = tokenType // No need to map since we're using the correct keys now
    updateTokenState(tokenKey, { isRequestLoading: true })

    // This will be handled by the CCIP refill hook
    // Just set the cooldown here
    setTimeout(() => {
      updateTokenState(tokenKey, { 
          isRequestLoading: false,
          requestCooldownTime: 24 * 60 * 60, // 24 hours cooldown for fuel button
      })
    }, 2000)
  }

  // Update global volatility (called from either ACTIVE or LINK fuel button)
  const updateGlobalVolatility = (volatilityMultiplier: number) => {
    // CONSOLIDATION: Update Zustand store directly instead of local state
    updateVolatility({
        multiplier: volatilityMultiplier,
        isUpdating: false,
    })

    // Update current drip amounts based on volatility
    const activeBaseDrip = activeTokenState.baseDripAmount  // Changed from monBaseDrip
    const linkBaseDrip = linkTokenState.baseDripAmount
    
    updateTokenState('active', {
      currentDripAmount: Math.floor(activeBaseDrip * volatilityMultiplier),  // Changed from monBaseDrip
    })
    
    updateTokenState('link', {
      currentDripAmount: Math.floor(linkBaseDrip * volatilityMultiplier),
    })
  }

  const setVolatilityUpdating = (isUpdating: boolean) => {
    // CONSOLIDATION: Update Zustand store directly instead of local state
    updateVolatility({ isUpdating })
  }

  // Refill tank from vault (called after successful CCIP request)
  const refillTankFromVault = async (tokenType: "active" | "link", refillAmount: number) => {  // Changed from "mon" | "link"
    // CONSOLIDATION: Update Zustand store directly instead of local state
    const currentBalance = tokenType === 'active' ? activeTokenState.tankBalance : linkTokenState.tankBalance  // Changed from 'mon'
    const tokenKey = tokenType // No need to map since we're using the correct keys now
    updateTokenState(tokenKey, {
      tankBalance: currentBalance + refillAmount,
    })

    // After updating pool locally, refresh on-chain drip & threshold
    await refreshSnapshot()
  }

  // Check if tank is low (show fuel button)
  const isTankLow = (tokenType: "active" | "link") => {  // Changed from "mon" | "link"
    const token = faucet[tokenType]
    // Dynamic threshold based on current drip and on-chain factor
    const threshold = token.currentDripAmount * (token.lowTankThreshold / token.currentDripAmount)
    return token.tankBalance < threshold
  }

  // Refresh vault balances (can be called manually)
  const refreshVaultBalances = async () => {
    try {
      await fetchAllFaucetData()
    } catch (error) {
      console.error('Failed to refresh vault balances:', error)
    }
  }

  // 🚀 Initial vault balance fetch
  useEffect(() => {
    fetchAllFaucetData()
  }, [fetchAllFaucetData])

  // CONSOLIDATED: Listen for faucet refresh events with network validation
  useEffect(() => {
    const handleFaucetRefresh = async (event: CustomEvent) => {
      const { userAddress } = event.detail
      console.log('🔄 [DEBUG] useFaucet: Received refresh event from consolidated pipeline', { 
        userAddress,
        timestamp: new Date().toISOString(),
        eventType: event.type
      })
      
      // 🔧 FIX: Use direct validation logic instead of external function reference
      // This avoids dependency array issues while ensuring fresh validation
      try {
        // Always attempt the refresh - let refreshSnapshot handle validation internally
        console.log('🔄 [DEBUG] Attempting contract data refresh...')
        console.log('   → Current Zustand state before refresh:', {
          activeTokenState: {
            tankBalance: activeTokenState.tankBalance,
            currentDripAmount: activeTokenState.currentDripAmount,
            maxTankBalance: activeTokenState.maxTankBalance
          },
          linkTokenState: {
            tankBalance: linkTokenState.tankBalance,
            currentDripAmount: linkTokenState.currentDripAmount,
            maxTankBalance: linkTokenState.maxTankBalance
          }
        })
        
        await refreshSnapshot(userAddress)
        
        console.log('✅ [DEBUG] Contract data refresh completed successfully')
        console.log('   → Zustand state after refresh:', {
          activeTokenState: {
            tankBalance: activeTokenState.tankBalance,
            currentDripAmount: activeTokenState.currentDripAmount,
            maxTankBalance: activeTokenState.maxTankBalance
          },
          linkTokenState: {
            tankBalance: linkTokenState.tankBalance,
            currentDripAmount: linkTokenState.currentDripAmount,
            maxTankBalance: linkTokenState.maxTankBalance
          }
        })
      } catch (error) {
        console.log('❌ [DEBUG] Contract data refresh failed - likely unsupported network or no contracts')
        console.log('   → Error details:', error)
        console.log('   → refreshSnapshot will handle setting zero values')
        // refreshSnapshot's error handler will set zero values, so we don't need to duplicate that logic
      }
    }

    // Listen for the custom refresh event
    window.addEventListener('faucet-refresh-needed', handleFaucetRefresh as EventListener)
    
    return () => {
      window.removeEventListener('faucet-refresh-needed', handleFaucetRefresh as EventListener)
    }
  }, [updateTokenState]) // 🔧 FIX: Remove requireActiveChain from dependencies

  // REMOVED: Old individual cooldown timer - now handled by centralized timer in Zustand store
  // This eliminates one of the major sources of RPC calls (3,600 calls/hour)

  const formatCooldown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return {
    faucet,
    dripTokens,
    requestTokens: dripTokens,
    requestVolatilityAndRefill, // Fuel button action
    updateGlobalVolatility,
    setVolatilityUpdating,
    refillTankFromVault,
    formatCooldown,
    isTankLow,
    refreshVaultBalances, // ✅ New function for manual refresh
  }
}
