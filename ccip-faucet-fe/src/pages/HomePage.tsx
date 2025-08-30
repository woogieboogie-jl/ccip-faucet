import { useState, useEffect, useCallback } from "react"
import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi"
import { parseAbi, formatEther } from "viem"
import { Header } from "@/components/header"
import { FaucetSection } from "@/components/faucet-section"
import { VolatilityCard } from "@/components/volatility/VolatilityCard"
import { VaultStatus } from "@/components/vault-status"
import { CollapsibleSection } from "@/components/collapsible-section"
import { TokenRain } from "@/components/token-rain"
import { GasFreeModal } from "@/components/gas-free-modal"
import { NotificationContainer, useNotificationManager } from "@/components/notification-toast"
import { EventTestPanel } from "@/components/event-test-panel"
import { Activity, Vault } from "lucide-react"
import { useFaucet } from "@/hooks/use-faucet"
import { useFaucetOwner } from "@/hooks/use-faucet-owner"
import { useNetworkSwitch } from "@/hooks/use-network-switch"
import { useVolatilityData, useVolatilityUtils } from "@/store/faucet-store"
import { setCCIPNotificationFunctions } from "@/hooks/use-ccip-refill"
import { configService } from "@/lib/config"
import { getAddresses } from "@/lib/config"
import { createConfigDrivenPublicClient } from "@/lib/config/chain/viem-client"
import { cachedContractRead } from "@/lib/request-cache"
import { configLoader } from "@/lib/config/core/loader"
import type { DerivedConfig } from '@/lib/types/config'

export function HomePage() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [monBalance, setMonBalance] = useState(0)
  const [linkBalance, setLinkBalance] = useState(0)
  const [derivedConfig, setDerivedConfig] = useState<DerivedConfig | null>(null)
  const [activeChainName, setActiveChainName] = useState<string | null>(null)
  const [hasWallet, setHasWallet] = useState(false)
  
  // Admin panel state management
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false)
  
  // PHASE 1: Notification system for instant feedback
  const { showSuccess, showError, showInfo, showWarning } = useNotificationManager()
  
  // CONSOLIDATION: Use Zustand volatility state instead of useVolatility hook
  const { volatility, isLoading: isVolatilityLoading } = useVolatilityData()
  const {
    getDripMultiplier,
    getVolatilityLevel,
    getVolatilityColor,
    getDripReasoning,
    updateVolatilityScore,
  } = useVolatilityUtils()
  
  // Fetch real faucet owner from consolidated hook
  const { faucetOwner, isOwnerLoading } = useFaucetOwner()
  
  // Network switching functionality
  const networkSwitch = useNetworkSwitch()
  
  // PHASE 1: Event-driven updates for instant feedback
  // const { isSubscribed: isEventDrivenActive } = useEventDrivenUpdates() // This line is removed
  
  // Connect notification system to event-driven updates
  useEffect(() => {
    setCCIPNotificationFunctions(showSuccess, showError, showInfo, showWarning)
  }, [showSuccess, showError, showInfo, showWarning])

  // 🎯 Detect wallet availability on mount
  useEffect(() => {
    const checkWallet = () => {
      const walletAvailable = typeof window !== 'undefined' && !!window.ethereum
      setHasWallet(walletAvailable)
      console.log('👛 Wallet detection:', walletAvailable ? 'Found' : 'Not found')
    }
    
    checkWallet()
    
    // Also check when window loads (in case wallet extension loads late)
    if (typeof window !== 'undefined') {
      window.addEventListener('load', checkWallet)
      return () => window.removeEventListener('load', checkWallet)
    }
  }, [])
  
  // Log event-driven updates status and connect to notifications
  useEffect(() => {
    // if (isEventDrivenActive) { // This line is removed
    //   console.log('✅ Event-driven updates are active - instant feedback enabled!') // This line is removed
    //   showSuccess('Event System Active', 'Real-time updates are now enabled', 3000) // This line is removed
    // } // This line is removed
  }, []) // This line is removed

  // 🎯 CONSOLIDATED: Track active chain changes with polling
  useEffect(() => {
    const checkActiveChain = () => {
      const currentActiveChain = configLoader.getActiveChainName()
      if (currentActiveChain !== activeChainName) {
        console.log(`🔄 HomePage: Active chain changed from ${activeChainName} to ${currentActiveChain}`)
        setActiveChainName(currentActiveChain)
      }
    }

    // Check immediately and then poll every 100ms for changes
    checkActiveChain()
    const interval = setInterval(checkActiveChain, 100)
    
    return () => clearInterval(interval)
  }, [activeChainName])

  // Load derived config when active chain changes
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await configService.getActiveChainConfig()
        setDerivedConfig(config.derivedConfig)
        
        console.log(`🎨 HomePage: Updated derivedConfig for ${config.derivedConfig.nativeName}`)
        console.log(`🔍 HomePage: Chain config details:`, {
          chainName: config.chainConfig.name,
          ticker: config.chainConfig.ticker,
          nativeTokenIcon: config.derivedConfig.nativeTokenIcon,
          chainId: config.chainConfig.chainId,
          activeChainName
        })
      } catch (error) {
        console.error('Failed to load derived config:', error)
      }
    }
    
    // Only load config if we have an active chain name
    if (activeChainName !== null) {
      loadConfig()
    }

    // Listen for wallet chain changes to reload config for ticker updates
    const handleChainChange = (chainId: string) => {
      console.log('🔄 HomePage: Wallet chain changed to:', chainId, 'reloading config...')
      // Add delay to ensure consolidated pipeline + theme loading completes first
      setTimeout(() => {
        console.log('🔄 HomePage: Executing delayed config reload...')
        loadConfig() // Only reload config, not everything
      }, 300) // Wait for consolidated pipeline + theme loading
    }

    // Listen for wallet chain changes only
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', handleChainChange)
      
      return () => {
        (window as any).ethereum?.removeListener('chainChanged', handleChainChange)
      }
    }
  }, [activeChainName]) // 🎯 CONSOLIDATED: Re-run when activeChainName changes

  // Mock fetchVolatilityData for backward compatibility (not used in current flow)
  const fetchVolatilityData = async () => {
    // This function is not used in the current flow since volatility updates come from CCIP
  }

  // Fetch real MON and LINK balances from blockchain when wallet connects
  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !isConnected) {
        console.log('HomePage: No address or not connected, setting balances to 0')
        setMonBalance(0)
        setLinkBalance(0)
        return
      }

      try {
        console.log('HomePage: Fetching balances for address:', address)
        
        const linkTokenAbi = parseAbi(['function balanceOf(address) view returns (uint256)'])

        // Get config-driven addresses and public client
        const addresses = await getAddresses()
        const publicClient = await createConfigDrivenPublicClient()

        // Use cached contract reads for user balances
        const [monBalanceRaw, linkBalanceRaw] = await Promise.all([
          cachedContractRead(
            'userMonBalance',
            () => publicClient.getBalance({ address }),
            [address],
            30 * 1000 // 30 seconds cache for user balances
          ),
          addresses.ACTIVE_CHAIN_LINK_TOKEN ? cachedContractRead(
            'userLinkBalance',
            () => publicClient.readContract({
              address: addresses.ACTIVE_CHAIN_LINK_TOKEN as `0x${string}`,
              abi: linkTokenAbi,
              functionName: 'balanceOf',
              args: [address],
            }) as Promise<bigint>,
            [address],
            30 * 1000 // 30 seconds cache for user balances
          ) : Promise.resolve(0n)
        ])

        setMonBalance(Number(formatEther(monBalanceRaw)))
        setLinkBalance(Number(formatEther(linkBalanceRaw)))
      } catch (error) {
        console.error('Failed to fetch balances:', error)
        setMonBalance(0)
        setLinkBalance(0)
      }
    }

    fetchBalances()

    // OPTIMIZED: Only fetch balances when page is visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchBalances()
      }
    }

    // OPTIMIZED: Increased interval from 30s to 60s since we have caching
    const interval = setInterval(() => {
      // Only fetch if page is visible
      if (!document.hidden) {
        fetchBalances()
      }
    }, 60000)

    // Listen for visibility changes to refresh when user returns
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [address, isConnected, derivedConfig?.nativeName]) // 🆕 Re-fetch when chain changes

  // Mock wallet state for compatibility with existing components
  const walletState = {
    address: address || null,
    isConnected,
    isOwner: address?.toLowerCase() === faucetOwner?.toLowerCase(),
    nativeBalance: monBalance, // Use nativeBalance to match header interface
    linkBalance,
  }

  // Admin panel toggle function - ISOLATED: Only affects admin panel visibility
  const toggleAdminPanel = useCallback(() => {
    if (walletState.isOwner) {
      // CRITICAL: Only toggle the admin panel state, don't affect any other state
      setIsAdminPanelOpen(prev => !prev)
      console.log('🔒 Admin panel toggled:', !isAdminPanelOpen)
    }
  }, [walletState.isOwner, isAdminPanelOpen])

  // Debug owner check
  useEffect(() => {
    console.log('🔍 Owner Check Debug:', {
      address: address?.toLowerCase(),
      faucetOwner: faucetOwner?.toLowerCase(),
      isOwner: address?.toLowerCase() === faucetOwner?.toLowerCase(),
      isOwnerLoading,
      isConnected
    })
  }, [address, faucetOwner, isOwnerLoading, isConnected])

  // DEBUG: Monitor admin panel state changes to identify any side effects
  useEffect(() => {
    console.log('🔒 Admin Panel State Changed:', {
      isAdminPanelOpen,
      timestamp: new Date().toISOString(),
      walletConnected: isConnected,
      isOwner: walletState.isOwner
    })
  }, [isAdminPanelOpen, isConnected, walletState.isOwner])

  const updateNativeBalance = (newBalance: number) => { // Generic: was 'updateMonBalance'
    setMonBalance(newBalance)
    
    // Also fetch the real balance to ensure accuracy
    if (address && isConnected) {
      setTimeout(async () => {
        try {
          const publicClient = await createConfigDrivenPublicClient()
          const realBalance = await publicClient.getBalance({ address })
          const realBalanceInEther = Number(formatEther(realBalance))
          setMonBalance(realBalanceInEther)
        } catch (error) {
          console.error('Failed to refresh real MON balance:', error)
        }
      }, 2000) // Wait 2 seconds for transaction to be mined
    }
  }

  // Manual balance refresh function
  const refreshBalances = async () => {
    if (!address || !isConnected) return
    
    try {
      const addresses = await getAddresses()
      const publicClient = await createConfigDrivenPublicClient()
      
      // Refresh MON balance
      const monBalanceRaw = await publicClient.getBalance({ address })
      const monBalanceInEther = Number(formatEther(monBalanceRaw))
      setMonBalance(monBalanceInEther)

      // Refresh LINK balance
      if (addresses.ACTIVE_CHAIN_LINK_TOKEN) {
        const linkTokenAbi = parseAbi([
          'function balanceOf(address owner) view returns (uint256)'
        ])
        const linkBalanceRaw = await publicClient.readContract({
          address: addresses.ACTIVE_CHAIN_LINK_TOKEN as `0x${string}`,
          abi: linkTokenAbi,
          functionName: 'balanceOf',
          args: [address],
        }) as bigint
        const linkBalanceInEther = Number(formatEther(linkBalanceRaw))
        setLinkBalance(linkBalanceInEther)
      }
    } catch (error) {
      console.error('Failed to refresh balances:', error)
    }
  }

  // Update global volatility when CCIP request completes
  const updateGlobalVolatility = (volatilityMultiplier: number) => {
    // Convert multiplier back to score for volatility display
    const newScore = volatilityMultiplier >= 2.0 ? 20 
                   : volatilityMultiplier >= 1.5 ? 40
                   : volatilityMultiplier >= 1.0 ? 60
                   : volatilityMultiplier >= 0.7 ? 80
                   : 90
    updateVolatilityScore(newScore)
  }

  const setVolatilityUpdating = (updating: boolean) => {
    // This can be used for additional UI states if needed
  }

  const connectWallet = async () => {
    // 🎯 Check wallet availability first
    if (!hasWallet) {
      showInfo(
        'Wallet Required', 
        'Please install MetaMask or another Web3 wallet to connect to the faucet',
        5000
      )
      return
    }

    // Connect with the first available connector (usually MetaMask/Injected)
    const connector = connectors[0]
    if (connector) {
      try {
        await connect({ connector })
      } catch (error) {
        console.error('Failed to connect wallet:', error)
        showError('Connection Failed', 'Unable to connect to your wallet. Please try again.')
      }
    }
  }

  const disconnectWallet = () => {
    disconnect()
    setMonBalance(0)
    setLinkBalance(0)
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Debug theme application
  useEffect(() => {
    const checkTheme = () => {
      const root = document.documentElement
      const from = getComputedStyle(root).getPropertyValue('--chain-gradient-from')
      const mid = getComputedStyle(root).getPropertyValue('--chain-gradient-mid')
      const to = getComputedStyle(root).getPropertyValue('--chain-gradient-to')
      const blue = getComputedStyle(root).getPropertyValue('--chainlink-blue')
      console.log('🎨 Theme Debug - CSS Custom Properties:', { from, mid, to, blue })
    }
    
    // Check immediately and after a short delay to ensure theme is applied
    checkTheme()
    const timer = setTimeout(checkTheme, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  return (
    <div 
      className="min-h-screen relative"
      style={{
        background: `linear-gradient(to right, var(--chain-gradient-from, #8A5CF6) 0%, var(--chain-gradient-mid, #4566F2) 50%, var(--chainlink-blue, #006FEE) 100%)`
      }}
    >
      {/* PHASE 1: Notification system for instant feedback */}
      <NotificationContainer />
      
      {/* PHASE 1: Event test panel for development (Admin only) */}
      <EventTestPanel isOwner={walletState.isOwner} isAdminPanelOpen={isAdminPanelOpen} />
      
      {/* Dynamic Token Rain Background */}
      <TokenRain />
      
      <Header
        wallet={walletState}
        isConnecting={isPending}
        hasWallet={hasWallet}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        truncateAddress={truncateAddress}
        volatility={volatility}
        getVolatilityColor={getVolatilityColor}
        getVolatilityLevel={getVolatilityLevel}
        isAdminPanelOpen={isAdminPanelOpen}
        toggleAdminPanel={toggleAdminPanel}
        derivedConfig={derivedConfig}
      />

      <main className="space-y-8 pb-8">
        {/* 1. Faucet Section - Always visible */}
        <FaucetSection
          wallet={walletState}
          updateNativeBalance={updateNativeBalance}
          volatilityMultiplier={getDripMultiplier()}
          volatilityReasoning={getDripReasoning()}
          updateGlobalVolatility={updateGlobalVolatility}
          setVolatilityUpdating={setVolatilityUpdating}
          derivedConfig={derivedConfig}
        />

        {/* Separator Line */}
        <div className="container mx-auto px-4">
          <div className="w-full max-w-4xl mx-auto">
            <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
          </div>
        </div>

        {/* 3. Volatility Status - Collapsible */}
        <div className="container mx-auto px-4">
          <CollapsibleSection title="Volatility Status" icon={<Activity className="h-4 w-4" />} defaultOpen={true}>
            <VolatilityCard
              volatility={volatility}
              getVolatilityLevel={getVolatilityLevel}
              getDripMultiplier={getDripMultiplier}
              derivedConfig={derivedConfig}
            />
          </CollapsibleSection>
        </div>

        {/* 3. Vault Status - Collapsible (Admin only) */}
        {walletState.isOwner && isAdminPanelOpen && (
          <div className="container mx-auto px-4">
            <CollapsibleSection title="Vault Status" icon={<Vault className="h-4 w-4" />} defaultOpen={true}>
              <VaultStatus isOwner={walletState.isOwner} derivedConfig={derivedConfig} />
            </CollapsibleSection>
          </div>
        )}
      </main>
      
      {/* Network Switch Modal */}
      {/* NetworkSwitchModal component was removed, so this block is now empty */}
    </div>
  )
} 