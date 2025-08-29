
import { useMemo, useCallback, useEffect, useState } from "react"
import { formatEther } from "viem"

import { Card, CardContent } from "@/components/ui/card"

import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ActionButton } from "@/components/ui/action-button"
import { cn } from "@/lib/utils"
import { GasFreeModal } from "@/components/gas-free-modal"
import { useFaucet } from "@/hooks/use-faucet"
// CONSOLIDATION: Use Zustand UI state instead of local useState
import { useTokenState, useVaultState, useUIState, useFaucetStore, useVolatilityState, useCCIPRequest, useAddressState, useAddressUtils } from "@/store/faucet-store"
// NEW: Use the new CCIP refill hook instead of the old one
import { useCCIPRefillNew } from "@/hooks/use-ccip-refill"
import { useRequireActiveChain } from '@/hooks/use-require-active-chain'
import { useAutoCooldownManager } from "@/hooks/use-cooldown-manager"
import { getFaucetSnapshot } from "@/lib/faucetClient"
import { Copy, ExternalLink, Fuel, TrendingUp, TrendingDown, Info, CheckCircle, AlertTriangle, Droplets, Check, Zap, XCircle, X } from "lucide-react"
import { formatBalance } from "@/lib/utils"
import { getCCIPPhaseText, getCCIPPhaseTooltip, getCCIPColors, getHelperCCIPColors } from "@/lib/ccip-utils"
import { getHelperChainConfig } from "@/lib/config"
import { getCCIPExplorerUrl, getConfigExplorerUrl } from "@/lib/config/ui/constants"
import type { DerivedConfig } from '@/lib/types/config'
import { useWalletClient } from "wagmi"



// CONSOLIDATED: Use the existing configurable explorer URL function

interface WalletState {
  address: string | null
  isConnected: boolean
  isOwner: boolean
  nativeBalance: number  // Generic: was 'monBalance'
  linkBalance: number
}

interface FaucetSectionProps {
  wallet: WalletState
  updateNativeBalance: (balance: number) => void  // Generic: was updateMonBalance
  volatilityMultiplier: number
  volatilityReasoning: string
  updateGlobalVolatility: (volatility: number) => void
  setVolatilityUpdating: (updating: boolean) => void
  derivedConfig?: DerivedConfig | null
}

/**
 * FaucetSection - Main faucet interface component
 * 
 * PHASE 4D: Optimized with memoization and performance improvements
 * 
 * Features:
 * - Dual-token faucet (MON/LINK) with dynamic drip amounts
 * - Network validation and user guidance
 * - CCIP-based cross-chain volatility updates
 * - Gas-free transactions for new users
 * - Real-time balance updates and cooldown management
 * 
 * Performance optimizations:
 * - Memoized button state calculations
 * - Optimized event handlers with useCallback
 * - Selective Zustand subscriptions
 * - Reduced console.log noise in production
 * 
 * @param props - Component props including wallet state and handlers
 * @returns JSX element for the faucet interface
 */
export function FaucetSection({
  wallet,
  updateNativeBalance,
  volatilityMultiplier,
  volatilityReasoning,
  updateGlobalVolatility,
  setVolatilityUpdating,
  derivedConfig,
}: FaucetSectionProps) {
  const {
    faucet,
    dripTokens,
    refillTankFromVault,
    formatCooldown,
    isTankLow,
  } = useFaucet()
  
  // Read tank balances from Zustand store instead of local state
  const activeTokenState = useTokenState('active')  // Generic: was 'mon'
  const linkTokenState = useTokenState('link')
  const vaultBalances = useVaultState()
  
  // CONSOLIDATION: Use Zustand UI state instead of local useState
  const { isGasFreeModalOpen, copiedAddresses, dripStates } = useUIState()
  const { setGasFreeModalOpen, setCopiedAddress, setDripState } = useFaucetStore()
  
  // CONSOLIDATION: Add volatility state from Zustand store
  const volatilityState = useVolatilityState()

  // CONSOLIDATION: Add wallet client hook at component level
  const { data: walletClient } = useWalletClient()

  // 🆕 CONSOLIDATION: Use Zustand address state instead of separate loading
  const addresses = useAddressState()
  const { loadAddresses } = useAddressUtils()

  // UNIFIED: Helper chain color state for CCIP UI
  const [helperChainColor, setHelperChainColor] = useState<string>('#8A5CF6') // Generic purple fallback


  
  // UNIFIED: Load helper chain color for CCIP UI
  useEffect(() => {
    const loadHelperChainColor = async () => {
      try {
        const helperConfig = await getHelperChainConfig()
        if (helperConfig?.themeColor) {
          const helperColors = getHelperCCIPColors(helperConfig.themeColor)
          setHelperChainColor(helperColors.text)
        }
      } catch (error) {
        console.warn('⚠️ Failed to load helper chain color, using fallback:', error)
        // Keep the default fallback color
      }
    }
    loadHelperChainColor()
  }, [])

  // 🆕 CONSOLIDATED: Load addresses from Zustand on mount and chain change
  useEffect(() => {
    if (!addresses || !addresses.FAUCET_ADDRESS) {
      console.log('🏪 Loading addresses into Zustand store...')
      loadAddresses()
    }
  }, [derivedConfig?.nativeName, loadAddresses, addresses?.FAUCET_ADDRESS]) // Re-run when chain changes

  // DEBUG: Monitor component re-renders and cooldown state
  useEffect(() => {
    console.log('🔄 FaucetSection re-render detected:', {
      activeCooldown: activeTokenState.dripCooldownTime,
      linkCooldown: linkTokenState.dripCooldownTime,
      activeLoading: activeTokenState.isDripLoading,
      linkLoading: linkTokenState.isDripLoading,
      timestamp: new Date().toISOString()
    })
  }, [activeTokenState.dripCooldownTime, linkTokenState.dripCooldownTime, activeTokenState.isDripLoading, linkTokenState.isDripLoading])
  
  // NEW: Use unified CCIP system instead of individual token hooks
  const ccipRequest = useCCIPRequest()
  const { initiateRefillProcess, resetToIdle } = useCCIPRefillNew()
  
  // PHASE 4A: Memoize clipboard and explorer functions to prevent re-creation
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddress(text, true)
    setTimeout(() => {
      setCopiedAddress(text, false)
    }, 2000) // Reset after 2 seconds
  }, [setCopiedAddress])

  const openExplorer = useCallback(async (address: string) => {
    try {
      const explorerUrl = await getConfigExplorerUrl('active', 'address', address)
      window.open(explorerUrl, "_blank")
    } catch (error) {
      console.warn('⚠️ Cannot open explorer: Failed to get explorer URL', error)
    }
  }, [])

  // PHASE 4A: Memoize network check to prevent constant re-evaluation
  const requireMonad = useRequireActiveChain()
  const isCorrectNetwork = useMemo(() => requireMonad(), [requireMonad])

  // PHASE 4A: Memoize expensive button state calculations
  const getDripButtonState = useCallback((tokenType: "active" | "link") => {  // Generic: was "mon" | "link"
    const tokenState = tokenType === 'active' ? activeTokenState : linkTokenState  // Generic: was 'mon'

    // DEBUG: Log cooldown state for diagnosis
    console.log(`🔍 ${tokenType} Drip Button State:`, {
      walletConnected: wallet.isConnected,
      correctNetwork: isCorrectNetwork,
      tankBalance: tokenState.tankBalance,
      currentDripAmount: tokenState.currentDripAmount,
      dripCooldownTime: tokenState.dripCooldownTime,
      isDripLoading: tokenState.isDripLoading,
      nativeBalance: wallet.nativeBalance,
    })

    if (!wallet.isConnected) {
      return { text: "Connect Wallet", disabled: true, isGasFree: false }
    }

    // Check network compatibility first - disable button if on wrong network
    if (!isCorrectNetwork) {
      return { text: "Wrong Network", disabled: true, isGasFree: false, wrongNetwork: true }
    }

    // Check if tank is empty or insufficient for drip (use Zustand store data)
    if (tokenState.tankBalance <= 0) {
      return { text: "Tank Empty - Use Refuel", disabled: true, isGasFree: false, isEmpty: true }
    }
    
    if (tokenState.tankBalance < tokenState.currentDripAmount) {
      return { 
        text: `Insufficient Tank (${formatBalance(tokenState.tankBalance)} < ${formatBalance(tokenState.currentDripAmount)})`, 
        disabled: true, 
        isGasFree: false, 
        isEmpty: true 
      }
    }

    // New user with zero balance - show gas-free option for native token drip only
    if (wallet.nativeBalance === 0 && tokenType === "active") {  // Generic: was "mon"
      return { text: `Get First ${derivedConfig?.nativeSymbol || 'MON'} (Gas-Free)`, disabled: false, isGasFree: true }
    }

    // FIXED: Use Zustand store for loading and cooldown checks instead of local state
    if (tokenState.isDripLoading) {
      return { text: "Dripping...", disabled: true, loading: true, isGasFree: false }
    }

    if (tokenState.dripCooldownTime > 0) {
      const cooldownText = formatCooldown(tokenState.dripCooldownTime)
      console.log(`⏱️ ${tokenType} Drip Button: Cooldown active - ${cooldownText} (${tokenState.dripCooldownTime}s remaining)`)
      return { text: cooldownText, disabled: true, isGasFree: false }
    }

    return { text: "Drip", disabled: false, isGasFree: false }
  }, [wallet.isConnected, wallet.nativeBalance, isCorrectNetwork, activeTokenState, linkTokenState, formatCooldown, derivedConfig])

  const getFuelButtonState = useCallback((tokenType: "active" | "link") => {  // Generic: was "mon" | "link"
    const tokenState = tokenType === 'active' ? activeTokenState : linkTokenState  // Generic: was 'mon'
    // Use memoized network check instead of calling requireMonad() again
    // Use vault balances from Zustand store (updated by fetchAllFaucetData)
    const vaultEmpty = tokenType === "active" ? vaultBalances.active === 0 : vaultBalances.link === 0  // Generic: was "mon" and vaultBalances.mon

    // DEBUG: Log vault balance and empty state
    console.log(`🔍 ${tokenType} vault balance:`, tokenType === "active" ? vaultBalances.active : vaultBalances.link, `Empty: ${vaultEmpty}`)

    // SIMPLIFIED: Just check if button should be enabled or disabled
    const isEnabled = wallet.isConnected && 
                     isCorrectNetwork && 
                     ccipRequest.status === "idle" && 
                     !vaultEmpty && 
                     tokenState.requestCooldownTime === 0 &&
                     tokenState.tankBalance <= tokenState.lowTankThreshold

    // DEBUG: Log button state conditions
    console.log(`🔍 ${tokenType} Fuel Button State:`, {
      walletConnected: wallet.isConnected,
      correctNetwork: isCorrectNetwork,
      ccipStatus: ccipRequest.status,
      vaultEmpty,
      cooldownTime: tokenState.requestCooldownTime,
      tankBalance: tokenState.tankBalance,
      lowThreshold: tokenState.lowTankThreshold,
      isEnabled,
      disabled: !isEnabled
    })

    return { 
      text: "Refuel",  // SIMPLIFIED: Always "Refuel"
      disabled: !isEnabled, 
      canRequest: isEnabled 
    }
  }, [wallet.isConnected, isCorrectNetwork, activeTokenState, linkTokenState, ccipRequest.status, vaultBalances])

  // Memoized values to prevent flickering - use boolean states instead of exact countdown values
  const anyRequestActive = useMemo(() => 
    ccipRequest.status === "running"
  , [ccipRequest.status])

  // PHASE 4A: Memoize button states to prevent expensive recalculations
  const activeDripButtonState = useMemo(() => getDripButtonState("active"), [getDripButtonState])  // Generic: was monDripButtonState and "mon"
  const linkDripButtonState = useMemo(() => getDripButtonState("link"), [getDripButtonState])
  const activeFuelButtonState = useMemo(() => getFuelButtonState("active"), [getFuelButtonState])  // Generic: was monFuelButtonState and "mon"
  const linkFuelButtonState = useMemo(() => getFuelButtonState("link"), [getFuelButtonState])

  // PHASE 4A: Memoize event handlers to prevent re-creation
  const handleActiveDrip = useCallback(() => {  // Generic: was handleMonDrip
    console.log('[handleActiveDrip] called')  // Generic: was '[handleMonDrip] called'
    if (activeDripButtonState.isGasFree) {  // Generic: was monDripButtonState
      setGasFreeModalOpen(true)
    } else {
      dripTokens("active")  // Generic: was "mon"
    }
  }, [activeDripButtonState.isGasFree, setGasFreeModalOpen, dripTokens])  // Generic: was monDripButtonState

  const handleLinkDrip = useCallback(() => {
    dripTokens("link")
  }, [dripTokens])

  const handleFuelButtonClick = useCallback(async (tokenType: "active" | "link") => {  // Generic: was "mon" | "link"
    console.log(`🚀 handleFuelButtonClick called for ${tokenType}`)
    
    if (!walletClient) {
      console.error('❌ Wallet client not available')
      return
    }

    try {
      // Set volatility updating state
      setVolatilityUpdating(true)
      
      // Use the new unified CCIP system
      await initiateRefillProcess()
      
      // Reset volatility updating state
      setVolatilityUpdating(false)
      
    } catch (error) {
      console.error(`❌ Error in handleFuelButtonClick for ${tokenType}:`, error)
      setVolatilityUpdating(false)
    }
  }, [walletClient, initiateRefillProcess, setVolatilityUpdating])

  const { setDripCooldown } = useAutoCooldownManager()

  // PHASE 4A: Memoize gas-free success handler
  const handleGasFreeSuccess = useCallback(async () => {
    console.log('🎉 [AA SUCCESS] handleGasFreeSuccess called - starting post-transaction updates')
    
    // 1) Optimistically bump wallet balance in parent component
    console.log('💰 [AA SUCCESS] Updating wallet balance by:', faucet.active.currentDripAmount)
    updateNativeBalance(faucet.active.currentDripAmount)

    // 2) Show refreshing state while we fetch fresh data
    const { updateTokenState } = useFaucetStore.getState()
    
    updateTokenState('active', { 
      isRefreshing: true  // Show spinner while refreshing tank balance
    })

    try {
      // 3) Wait a moment for the transaction to be mined and indexed
      console.log('⏳ [AA SUCCESS] Waiting 2 seconds for transaction to be indexed...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 4) Clear cache to ensure fresh data after AA transaction
      console.log('🧹 [AA SUCCESS] Clearing cache to ensure fresh data...')
      const { invalidateAllFaucetCache } = await import('@/lib/request-cache')
      invalidateAllFaucetCache()
      
      // 5) Read on-chain cooldown so we avoid hard-coding any value
      console.log('📊 [AA SUCCESS] Fetching fresh contract snapshot for cooldown and tank balance...')
      const snap = await getFaucetSnapshot(wallet.address as `0x${string}` | undefined)
      const contractCooldown = snap.constants.cooldown // seconds

      console.log('⏰ [AA SUCCESS] Setting cooldown timer:', contractCooldown, 'seconds')
      // 6) Start local countdown timer via centralized cooldown manager
      setDripCooldown('active', contractCooldown)  // Generic: was 'mon'
      
      // 7) Update tank balance from fresh contract data
      const freshTankBalance = Number(formatEther(snap.active.pool))  // Generic: was 'mon.pool'
      
      console.log('🏦 [AA SUCCESS] Updated tank balance:', freshTankBalance)
      updateTokenState('active', { 
        tankBalance: freshTankBalance,
        isRefreshing: false  // Remove refreshing state
      })
    } catch (e) {
      console.warn('⚠️ [AA SUCCESS] Failed to fetch snapshot for cooldown, will rely on periodic refresh:', e)
      updateTokenState('active', { isRefreshing: false })
    }
    
    console.log('✅ [AA SUCCESS] handleGasFreeSuccess completed')
  }, [updateNativeBalance, faucet.active.currentDripAmount, wallet.address, setDripCooldown])

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes === 1) return "1 minute ago"
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours === 1) return "1 hour ago"
    return `${diffInHours} hours ago`
  }

  // Enhanced drip action with better animation
  const handleDripWithAnimation = (tokenType: "active" | "link") => {  // Generic: was "mon" | "link"
    // Trigger the enhanced animation
    setDripState(tokenType, true)
    
    // Call the actual drip function
    if (tokenType === "active") {  // Generic: was "mon"
      handleActiveDrip()
    } else {
      handleLinkDrip()
    }
    
    // Reset animation state after completion
    setTimeout(() => {
      setDripState(tokenType, false)
    }, 800)
  }

  const renderAssetCard = (tokenType: "active" | "link") => {
    const tokenState = tokenType === 'active' ? activeTokenState : linkTokenState
    const token = faucet[tokenType]
    const symbol = tokenType === 'active' ? (derivedConfig?.nativeSymbol || 'NATIVE') : 'LINK'
    const dripButtonState = tokenType === "active" ? activeDripButtonState : linkDripButtonState
    const fuelButtonState = tokenType === "active" ? activeFuelButtonState : linkFuelButtonState
              // Use ccipRequest directly for new CCIP system

    // Define vaultEmpty for status messages
    const vaultEmpty = tokenType === "active" ? vaultBalances.active === 0 : vaultBalances.link === 0
    const isBelowThreshold = tokenState.tankBalance <= tokenState.lowTankThreshold

    // Get configurable CCIP colors from shared utility
    const ccipColors = getCCIPColors(derivedConfig)

    console.log(`🎨 renderAssetCard for ${tokenType}:`, {
      tokenState,
      token,
      symbol,
      tankBalance: tokenState.tankBalance,
      currentDripAmount: tokenState.currentDripAmount,
      baseDripAmount: tokenState.baseDripAmount,
    })

    // Show fuel button if tank is below actual contract threshold
    // const isBelowThreshold = tokenState.tankBalance <= tokenState.lowTankThreshold

    // Calculate tank percentage for progress bar
    const tankPercentage = Math.round((tokenState.tankBalance / tokenState.maxTankBalance) * 100)

    // Tank status color and text - use actual threshold instead of hardcoded 30%
    const getTankStatusColor = () => {
      if (tokenState.tankBalance <= tokenState.lowTankThreshold) return "text-red-400"
      if (tokenState.tankBalance <= tokenState.lowTankThreshold * 2) return "text-yellow-400"
      return "text-green-400"
    }

    const getTankStatusText = () => {
      if (tokenState.tankBalance <= tokenState.lowTankThreshold) return "Low"
      if (tokenState.tankBalance <= tokenState.lowTankThreshold * 2) return "Medium"
      return "Healthy"
    }

    // Calculate volatility indicators
    const isAmountReduced = tokenState.currentDripAmount < tokenState.baseDripAmount
    const isAmountIncreased = tokenState.currentDripAmount > tokenState.baseDripAmount

    // Tank status for display
    const tankStatusColor = getTankStatusColor()
    const tankStatus = getTankStatusText()

    // DEBUG: Log the current state to understand why progress bar might not show
    console.log(`🎯 ${symbol} renderAssetCard:`, {
      status: ccipRequest.status,
      progress: ccipRequest.progress,
      shouldShowProgress: ccipRequest.status === "running",
      currentPhase: ccipRequest.currentPhase,
    })

    return (
      <Card className={`bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-200 ${
        tokenType === "active" ? "relative z-0 overflow-visible" : ""
      }`}>
        <CardContent className={`p-4 lg:p-6 ${
          tokenType === "active" ? "overflow-visible" : ""
        }`}>
          <div className="space-y-4">
            {/* Asset Header - Clean without fuel button */}
            <div className="font-body text-center space-y-3">
              <div className="flex items-center justify-center">
                <h3 className="font-body text-2xl lg:text-3xl font-black text-white tracking-wide">{symbol}</h3>
              </div>

              {/* Enhanced Visual Tank Card - Drip Amount as Primary Header */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 hover:bg-white/8 hover:border-white/20">
                {/* Primary Header: Drip Amount with Volatility Indicator */}
                <div className="text-center mb-3">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="font-body text-2xl font-black text-white transition-all duration-200 hover:text-white/90 hover:scale-105">
                      {formatBalance(tokenState.currentDripAmount)}
                    </div>
                    {/* Volatility Indicator - Next to Drip Amount */}
                    {token.currentDripAmount !== token.baseDripAmount && (
                      <div className="flex items-center">
                        {isAmountReduced && <TrendingDown className="h-4 w-4 text-red-400 hover:text-red-300 transition-all duration-200 hover:scale-110" />}
                        {isAmountIncreased && <TrendingUp className="h-4 w-4 text-green-400 hover:text-green-300 transition-all duration-200 hover:scale-110" />}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-body text-white/60 uppercase tracking-wide">
                    Drip Amount
                  </div>
                </div>

                {/* Tank Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-body text-xs text-white/70">Tank Balance</span>
                    <span className="font-body text-xs text-white font-medium">
                      {formatBalance(tokenState.tankBalance)} {symbol}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 hover:bg-white/15 transition-colors duration-200">
                    <div 
                      className="h-2 rounded-full transition-all duration-500 ease-out bg-white/70 shadow-sm"
                      style={{ 
                        width: `${tokenState.maxTankBalance > 0 
                          ? Math.min((tokenState.tankBalance / tokenState.maxTankBalance) * 100, 100)
                          : 0
                        }%`
                      }}
                    />
                  </div>
                </div>


              </div>
            </div>

            {/* Enhanced Contract Information - Configurable per Token Type */}
            <div className="bg-white/5 rounded-lg p-3">
              {/* Native Token (MON): Show Contract with Placeholder */}
              {tokenType === 'active' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="font-body text-white/70 text-xs font-medium whitespace-nowrap">Contract:</span>
                                                <span className="font-mono text-white/50 text-xs italic flex-1">
                              Native without CA
                            </span>
                  </div>
                  <div className="flex space-x-1 ml-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => copyToClipboard(token.contractAddress)}
                          className={`p-1 hover:bg-white/10 rounded transition-all duration-200 ${
                            copiedAddresses[token.contractAddress] ? "bg-green-500/20" : ""
                          }`}
                        >
                          {copiedAddresses[token.contractAddress] ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3 text-white/70 hover:text-white" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                        <p className="font-body text-xs">{copiedAddresses[token.contractAddress] ? "Copied!" : "Copy faucet address"}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => openExplorer(token.contractAddress)}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-white hover:text-white transition-all duration-200 filter hover:brightness-125 hover:drop-shadow-sm" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                        <p className="font-body text-xs">View faucet on explorer</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}

              {/* LINK Token: Show LINK Token Contract Only */}
              {tokenType === 'link' && addresses?.ACTIVE_CHAIN_LINK_TOKEN && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="font-body text-white/70 text-xs font-medium whitespace-nowrap">Contract:</span>
                    <code className="font-mono text-white text-xs truncate flex-1">
                      {addresses.ACTIVE_CHAIN_LINK_TOKEN}
                    </code>
                  </div>
                  <div className="flex space-x-1 ml-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => copyToClipboard(addresses?.ACTIVE_CHAIN_LINK_TOKEN || '')}
                          className={`p-1 hover:bg-white/10 rounded transition-all duration-200 ${
                            copiedAddresses[addresses?.ACTIVE_CHAIN_LINK_TOKEN || ''] ? "bg-green-500/20" : ""
                          }`}
                        >
                          {copiedAddresses[addresses?.ACTIVE_CHAIN_LINK_TOKEN || ''] ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3 text-white/70 hover:text-white" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                        <p className="font-body text-xs">{copiedAddresses[addresses?.ACTIVE_CHAIN_LINK_TOKEN || ''] ? "Copied!" : "Copy contract address"}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => openExplorer(addresses?.ACTIVE_CHAIN_LINK_TOKEN || '')}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-white hover:text-white transition-all duration-200 filter hover:brightness-125 hover:drop-shadow-sm" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                        <p className="font-body text-xs">View contract on explorer</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Drip Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-center">
                {wallet.nativeBalance === 0 && dripButtonState.isGasFree ? (
                  <ActionButton
                    variant="green"
                    state={dripButtonState.disabled ? "disabled" : "enabled"}
                    icon={<Droplets className="h-4 w-4" />}
                    rightIcon={<Info className="h-3 w-3" />}
                    tooltip="Your first transaction is sponsored by a Paymaster!"
                    onClick={() => setGasFreeModalOpen(true)}
                    fullWidth
                    animated={!dripButtonState.disabled}
                  >
                    {dripButtonState.text}
                  </ActionButton>
                ) : (
                  <ActionButton
                    variant="primary"
                    state={dripButtonState.disabled ? "disabled" : "enabled"}
                    icon={<Droplets className="h-4 w-4" />}
                    rightIcon={<Info className="h-3 w-3" />}
                    tooltip={
                      (dripButtonState as any).wrongNetwork 
                        ? `Please switch to ${derivedConfig?.nativeName} to use the faucet` 
                        : (dripButtonState as any).isEmpty 
                        ? "Tank is empty or insufficient - use Refuel button below to fill from vault" 
                        : "Get tokens from the tank sent to your wallet"
                    }
                    onClick={() => handleDripWithAnimation(tokenType)}
                    fullWidth
                    animated={!dripButtonState.disabled}
                    className={cn(
                      !dripButtonState.disabled && "border-2",
                      !dripButtonState.disabled && "backdrop-blur-sm"
                    )}
                  >
                    {dripButtonState.text}
                  </ActionButton>
                )}
              </div>
            </div>





          </div>
        </CardContent>
      </Card>
    )
  }

  // UNIFIED: Render unified tank section for both assets
  const renderUnifiedTankSection = () => {
    // Get both token states
    const activeToken = activeTokenState
    const linkToken = linkTokenState
    const activeSymbol = derivedConfig?.nativeSymbol || 'NATIVE'
    
    // Check if either tank is below threshold (determines if refuel button should be enabled)
    const activeIsBelowThreshold = activeToken.tankBalance <= activeToken.lowTankThreshold
    const linkIsBelowThreshold = linkToken.tankBalance <= linkToken.lowTankThreshold
    const anyTankBelowThreshold = activeIsBelowThreshold || linkIsBelowThreshold
    
    // Check if either vault is empty
    const activeVaultEmpty = vaultBalances.active === 0
    const linkVaultEmpty = vaultBalances.link === 0
    const anyVaultEmpty = activeVaultEmpty || linkVaultEmpty
    
    // Unified refuel button state - enabled if at least one tank needs refilling AND its vault has balance
    const canRefuelNative = activeIsBelowThreshold && !activeVaultEmpty
    const canRefuelLink = linkIsBelowThreshold && !linkVaultEmpty
    const unifiedRefuelEnabled = wallet.isConnected && 
                                isCorrectNetwork && 
                                ccipRequest.status === "idle" && 
                                anyTankBelowThreshold &&
                                (canRefuelNative || canRefuelLink)

    // Get CCIP colors for progress bar
    const ccipColors = getCCIPColors(derivedConfig)

    return (
      <div className="max-w-4xl mx-auto mt-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            {/* Refuel Status Section - Always visible, button disabled when not needed */}
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                anyTankBelowThreshold 
                  ? "bg-yellow-500/20 border border-yellow-400/30" 
                  : "bg-green-500/20 border border-green-400/30"
              }`}>
                  <div className="flex items-center space-x-2">
                    {anyTankBelowThreshold ? (
                      <AlertTriangle className="h-3 w-3 text-yellow-400" />
                    ) : (
                      <CheckCircle className="h-3 w-3 text-green-400" />
                    )}
                    <span className={`font-body text-xs font-medium ${
                      anyTankBelowThreshold ? "text-yellow-300" : "text-green-300"
                    }`}>
                      {!wallet.isConnected ? "Connect wallet to refuel" :
                       !isCorrectNetwork ? "Switch to correct network" :
                       ccipRequest.status === "running" ? "CCIP transaction in progress" :
                       !anyTankBelowThreshold ? "All tanks are sufficiently filled" :
                       !canRefuelNative && !canRefuelLink ? "Required vaults are empty - cannot refuel" :
                       activeIsBelowThreshold && linkIsBelowThreshold 
                         ? `Both ${activeSymbol} and LINK tanks need refilling`
                         : activeIsBelowThreshold 
                           ? `${activeSymbol} tank needs refilling`
                           : 'LINK tank needs refilling'
                      }
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      setVolatilityUpdating(true)
                      try {
                        await initiateRefillProcess()
                        setVolatilityUpdating(false)
                      } catch (error) {
                        console.error('❌ Error in unified refuel:', error)
                        setVolatilityUpdating(false)
                      }
                    }}
                    disabled={!unifiedRefuelEnabled}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg gap-3 font-body cta-enhanced cta-fuel transition-all duration-200 ${
                      unifiedRefuelEnabled
                        ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/30 text-orange-300 hover:from-orange-500/30 hover:to-red-500/30 hover:text-orange-200 hover:border-orange-400/50 hover:scale-105 hover:shadow-lg"
                        : "!bg-white/5 !border !border-white/10 !text-white/40 !cursor-not-allowed !opacity-50"
                    }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className="relative">
                              <div className={`absolute inset-0 rounded-full animate-pulse ${
                          unifiedRefuelEnabled ? "bg-orange-400/20" : "bg-white/10"
                              }`}></div>
                              <Fuel className={`h-4 w-4 relative z-0 transition-all duration-200 ${
                          unifiedRefuelEnabled ? "text-orange-300 group-hover:text-orange-200 group-hover:scale-110" : "text-white/40"
                              }`} />
                            </div>
                      <span className="font-body text-xs font-medium transition-colors duration-200 group-hover:text-orange-100">Refuel All</span>
                          </div>
                        </button>
                  </div>

            {/* CCIP States Section - Mutually Exclusive States */}
                {ccipRequest.status !== "idle" && (
              <div className="mt-6">
                {/* Running State - Progress Display (Matches Legacy Structure) */}
                {ccipRequest.status === "running" && (
                  <div 
                    className="rounded-lg p-3 border border-blue-400/40 shadow-lg shadow-blue-800/10 transition-all duration-300 ease-in-out"
                    style={{
                      background: ccipColors.background
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {/* Animated Zap Icon with Tooltip - Same as individual cards */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="relative cursor-help">
                                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-bounce opacity-60"></div>
                                    <Zap className="h-4 w-4 text-yellow-300 relative z-0 animate-bounce" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                                  <p className="font-body text-xs max-w-[200px]">
                                    {getCCIPPhaseTooltip(ccipRequest.currentPhase)}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              <span className="font-body text-white text-xs font-semibold">
                                Cross-Chain Requests (CCIP)
                              </span>
                        {/* CCIP Explorer Links with Full Accessibility */}
                        {ccipRequest.outboundMessageId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => window.open(getCCIPExplorerUrl(ccipRequest.outboundMessageId!), '_blank')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    window.open(getCCIPExplorerUrl(ccipRequest.outboundMessageId!), '_blank')
                                  }
                                }}
                                className="p-1 hover:bg-white/10 rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-50"
                                style={{
                                  '--tw-ring-color': ccipColors.text,
                                  '--tw-ring-opacity': '0.5'
                                } as React.CSSProperties}
                                aria-label="View outbound CCIP transaction on explorer"
                              >
                                <ExternalLink 
                                  className="h-3.5 w-3.5 transition-all duration-200" 
                                  style={{ 
                                    color: ccipColors.text,
                                    filter: 'brightness(1.5)',
                                    WebkitTextStroke: '1px rgba(255,255,255,0.8)',
                                    textShadow: `0 0 20px ${ccipColors.text}`
                                  }}
                                />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                              <p className="font-body text-xs">View outbound message on CCIP Explorer</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {ccipRequest.responseMessageId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => window.open(getCCIPExplorerUrl(ccipRequest.responseMessageId!), '_blank')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    window.open(getCCIPExplorerUrl(ccipRequest.responseMessageId!), '_blank')
                                  }
                                }}
                                className="p-1 hover:bg-white/10 rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-50"
                                style={{
                                  '--tw-ring-color': helperChainColor,
                                  '--tw-ring-opacity': '0.5'
                                } as React.CSSProperties}
                                aria-label="View response CCIP transaction on explorer"
                              >
                                <ExternalLink 
                                  className="h-3.5 w-3.5 transition-all duration-200" 
                                  style={{ 
                                    color: helperChainColor,
                                    filter: 'brightness(1.5)',
                                    WebkitTextStroke: '1px rgba(255,255,255,0.8)',
                                    textShadow: `0 0 20px ${helperChainColor}`
                                  }}
                                />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                              <p className="font-body text-xs">View response message on CCIP Explorer</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <span className="font-body text-white text-sm font-bold">
                        {ccipRequest.progress}%
                                </span>
                            </div>

                    {/* Progress Bar - Clean White with Transparency */}
                    <div className="w-full bg-white/10 rounded-full h-2 mb-3 hover:bg-white/15 transition-colors duration-200">
                      <div 
                        className="h-2 rounded-full transition-all duration-500 ease-out bg-white/70"
                        style={{ 
                          width: `${ccipRequest.progress}%`
                        }}
                      />
                    </div>

                    {/* Status and Loading Dots - Matches Legacy Layout */}
                    <div className="flex items-center justify-between">
                      <span className="font-body text-white text-xs">
                        Refilling {activeSymbol} + LINK
                      </span>
                            <div className="flex space-x-1">
                              <div 
                          className="w-1 h-1 rounded-full animate-ping border border-white/20"
                                style={{ 
                                  backgroundColor: ccipColors.dots[0],
                                  boxShadow: `0 0 8px ${ccipColors.dots[0]}, 0 0 16px ${ccipColors.dots[0]}80, inset 0 0 2px rgba(255,255,255,0.3)`
                                }}
                              ></div>
                              <div 
                          className="w-1 h-1 rounded-full animate-ping border border-white/20" 
                                style={{ 
                                  backgroundColor: ccipColors.dots[1],
                                  animationDelay: '0.2s',
                                  boxShadow: `0 0 8px ${ccipColors.dots[1]}, 0 0 16px ${ccipColors.dots[1]}80, inset 0 0 2px rgba(255,255,255,0.3)`
                                }}
                              ></div>
                              <div 
                          className="w-1 h-1 rounded-full animate-ping border border-white/20" 
                                style={{ 
                                  backgroundColor: ccipColors.dots[2],
                                  animationDelay: '0.4s',
                                  boxShadow: `0 0 8px ${ccipColors.dots[2]}, 0 0 16px ${ccipColors.dots[2]}80, inset 0 0 2px rgba(255,255,255,0.3)`
                                }}
                              ></div>
                            </div>
                          </div>

                    {/* Phase Text with Tooltip - Matches Legacy */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                        <p className="font-body text-xs mt-2 cursor-help animate-pulse text-white">
                                {getCCIPPhaseText(ccipRequest.currentPhase)}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                              <p className="font-body text-xs max-w-[200px]">
                                {getCCIPPhaseTooltip(ccipRequest.currentPhase)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                )}

                {/* Failed State - Error Display (Replaces Progress) */}
                {ccipRequest.status === "failed" && (
                  <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3 transition-all duration-300 ease-in-out">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <span className="font-body text-red-300 text-sm font-medium">
                          Transaction Failed
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          console.log('🔄 Unified: Resetting CCIP request to idle')
                          resetToIdle()
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {ccipRequest.errorMessage && (
                      <p className="font-body text-red-200 text-xs mt-2 opacity-80">
                        {ccipRequest.errorMessage}
                      </p>
                    )}
                  </div>
                )}

                {/* Success State - Success Display (Replaces Progress) */}
                {ccipRequest.status === "success" && (
                  <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-3 transition-all duration-500 ease-in-out animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <CheckCircle className="h-4 w-4 text-green-400 animate-bounce" />
                          <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-30"></div>
                        </div>
                        <span className="font-body text-green-300 text-sm font-medium">
                          Refill Complete!
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                console.log('🔄 Unified: Resetting CCIP request to idle')
                                resetToIdle()
                              }}
                              className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 rounded text-xs text-green-300 hover:text-green-200 transition-all duration-200"
                            >
                              Done
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                            <p className="font-body text-xs">Dismiss notification</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                )}
            </div>
            )}
        </CardContent>
      </Card>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        {/* Title Section - Centered in available space */}
        <div className="flex-1 flex items-center justify-center px-4 pt-24 pb-20 relative z-10">
          <div className="text-center space-y-3">
            {/* First Line */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black starwars-title whitespace-nowrap">
              KEEP CALM AND BUILD 
            </h1>
            
            {/* Second Line */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black starwars-title whitespace-nowrap">
              {derivedConfig?.nativeSymbol || 'MON'} & LINK
            </h2>
          </div>
        </div>

        {/* Main Content Section */}
        <div className="container mx-auto px-4 space-y-6 lg:space-y-8 pb-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            {/* Native Token Card */}
                {renderAssetCard("active")}

            {/* LINK Card */}
                {renderAssetCard("link")}
          </div>

          {/* Unified CCIP Tank Refill Section */}
          {renderUnifiedTankSection()}
        </div>

        {/* Gas-Free Modal */}
          <GasFreeModal
            isOpen={isGasFreeModalOpen}
            onClose={() => setGasFreeModalOpen(false)}
            onSuccess={handleGasFreeSuccess}
            walletAddress={wallet.address || ""}
            dripAmount={faucet.active.currentDripAmount}
            derivedConfig={derivedConfig || undefined}
          />
      </div>
    </TooltipProvider>
  )
}
