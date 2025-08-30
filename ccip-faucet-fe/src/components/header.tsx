import { useState, useEffect } from "react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap, 
  MessageCircle, 
  Info, 
  Coins, 
  Lock,
  Unlock,
  LogIn,
  LogOut,
  Network,
  AlertTriangle
} from "lucide-react"
import { formatBalance } from "@/lib/utils"
import { useCCIPRequest } from "@/store/faucet-store"
import { useRainbowKitNetworkSwitch } from "@/hooks/use-rainbowkit-network-switch"
import { NetworkSwitchingModal } from "@/components/network-switching-modal"
import { getCCIPPhaseText, getCCIPPhaseTooltip, getCCIPColors } from '@/lib/ccip-utils'
import type { DerivedConfig } from '@/lib/types/config'

interface WalletState {
  address: string | null
  isConnected: boolean
  isOwner: boolean
  nativeBalance: number  // Generic: was 'monBalance'
  linkBalance: number
}

interface VolatilityData {
  score: number
  trend: "increasing" | "decreasing" | "stable"
  lastUpdate: Date
  source: string
}

interface HeaderProps {
  wallet: WalletState
  isConnecting: boolean
  hasWallet: boolean
  onConnect: () => void
  onDisconnect: () => void
  truncateAddress: (address: string) => string
  volatility: VolatilityData
  getVolatilityColor: () => string
  getVolatilityLevel: () => string
  isAdminPanelOpen?: boolean
  toggleAdminPanel?: () => void
  derivedConfig?: DerivedConfig | null
}

export function Header({
  wallet,
  isConnecting,
  hasWallet,
  onConnect,
  onDisconnect,
  truncateAddress,
  volatility,
  getVolatilityColor,
  getVolatilityLevel,
  isAdminPanelOpen,
  toggleAdminPanel,
  derivedConfig,
}: HeaderProps) {
  const ccipRequest = useCCIPRequest()
  
  // Get configurable CCIP colors
  const ccipColors = getCCIPColors(derivedConfig)

  // Network switching functionality
  const {
    isWrongNetwork,
    isUnsupportedNetwork,
    currentNetworkName,
    targetNetworkName,
    handleSwitchNetwork,
    openModal,
    closeModal,
    getAvailableChains,
    isSwitching,
    switchError,
    isModalOpen,
    currentChainId,
  } = useRainbowKitNetworkSwitch()

  const [availableChains, setAvailableChains] = useState<any[]>([])

  // FIXED: Load available chains once on mount (no dependency on getAvailableChains function)
  useEffect(() => {
    const loadChains = async () => {
      const chains = await getAvailableChains()
      setAvailableChains(chains)
    }
    loadChains()
  }, []) // Empty dependency array - load once on mount

  const handleNetworkButtonClick = () => {
    openModal()
  }

  const getTrendIcon = () => {
    switch (volatility.trend) {
      case "increasing":
        return <TrendingUp className="h-3 w-3" />
      case "decreasing":
        return <TrendingDown className="h-3 w-3" />
      default:
        return <Minus className="h-3 w-3" />
    }
  }

  // Remove the duplicate getActiveRequest function - use the one from useGlobalCCIP

  const getWalletDisplayText = () => {
    if (!wallet.address) return ""
    return `${wallet.address.slice(0, 4)}...${wallet.address.slice(-3)}`
  }

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-[100] w-full border-b border-white/20 bg-black/10 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between px-6 py-2">
          {/* Left side - Simple Title */}
          <div className="flex items-center">
            <h1 className="font-body text-white text-xl font-bold tracking-tight">PSEUDO (水道)</h1>
                </div>

          {/* Center - Status Components Wrapper */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <div className="hidden lg:flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 space-x-4 border border-white/20 h-8">
                  <div className="flex items-center space-x-2">
                <span className="font-body text-white/70 text-xs">
                  BTC-based Volatility Index:
                        </span>
                        <div className="flex items-center space-x-1">
                          <span className={`font-body text-sm font-semibold ${getVolatilityColor()}`}>
                            {volatility.score}
                          </span>
                          <span className={`${getVolatilityColor()}`}>{getTrendIcon()}</span>
                        </div>
                      </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/70 cursor-help transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                      <p className="font-body text-xs">Volatility Level: {getVolatilityLevel()} - Score: {volatility.score}/100 ({volatility.trend})</p>
                    </TooltipContent>
                  </Tooltip>

              {/* CCIP Status Display - Minimal */}
              {(() => {
                return ccipRequest.status !== "idle" ? (
                  <>
                    <div className="w-px h-4 bg-white/30"></div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-2 px-2 cursor-help">
                          {/* Animated Lightning Bolt */}
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-bounce opacity-60"></div>
                            <Zap className="h-4 w-4 text-yellow-300 relative z-10 animate-bounce" />
                          </div>

                          {/* Just percentage - Enhanced visibility */}
                          <span className="font-body text-white text-xs font-bold">
                            {ccipRequest.progress}%
                          </span>
                          
                          {/* Enhanced animated dots - better visibility without size change */}
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
                      </TooltipTrigger>
                      <TooltipContent className="z-[9999]" side="bottom" sideOffset={5}>
                        <p className="font-body text-xs">
                          {getCCIPPhaseTooltip(ccipRequest.currentPhase)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                ) : null
              })()}
            </div>
          </div>

          {/* Right side - Balance & Wallet Section */}
          <div className="flex items-center space-x-4">
            {/* Network Indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleNetworkButtonClick}
                  disabled={isSwitching}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200 ${
                    isUnsupportedNetwork
                      ? 'bg-red-500/20 border-red-400/40 hover:bg-red-500/30 cursor-pointer'
                      : 'bg-green-500/20 border-green-400/40 hover:bg-green-500/30 cursor-pointer'
                  } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSwitching ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  ) : isUnsupportedNetwork ? (
                    <AlertTriangle className="h-3 w-3 text-red-400" />
                  ) : (
                    <Network className="h-3 w-3 text-green-400" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="z-[9999]" side="bottom" sideOffset={5}>
                <p className="font-body text-xs">
                  {isSwitching 
                    ? 'Switching network...' 
                    : isUnsupportedNetwork 
                      ? `Click to switch networks (currently on unsupported network)` 
                      : `Click to switch networks (currently on ${currentNetworkName})`
                  }
                </p>
              </TooltipContent>
            </Tooltip>
            
            {wallet.isConnected ? (
              /* Connected State - Balance + Address + Logout */
              <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/20 h-8">
                {/* Balance Section */}
                <div className="flex items-center space-x-3">
                  {/* Native Token Balance - Dynamic based on current chain */}
                  <div className="hidden sm:flex items-center space-x-1.5">
                    <img 
                      src={derivedConfig?.nativeTokenIcon || "/tokens/mon.png"} 
                      alt={`${derivedConfig?.nativeSymbol || 'MON'} Token`} 
                      className="w-4 h-4 rounded-full shadow-sm border border-white/40"
                      onLoad={() => {
                        console.log(`🖼️ Header: Icon loaded successfully:`, derivedConfig?.nativeTokenIcon)
                      }}
                      onError={(e) => {
                        console.log(`❌ Header: Icon failed to load:`, derivedConfig?.nativeTokenIcon)
                        // Fallback to styled div if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.className = 'flex items-center justify-center w-4 h-4 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full shadow-sm border border-white/40';
                        const text = document.createElement('span');
                        text.className = 'text-white text-[10px] font-bold';
                        text.textContent = (derivedConfig?.nativeSymbol || 'M')[0];
                        fallback.appendChild(text);
                        target.parentNode?.appendChild(fallback);
                      }}
                    />
                    <span className="font-body text-white/90 text-xs font-medium">{formatBalance(wallet.nativeBalance)}</span>
                  </div>

                  {/* Separator */}
                  <div className="hidden sm:block w-px h-3 bg-white/30"></div>

                  {/* LINK Balance */}
                  <div className="hidden sm:flex items-center space-x-1.5">
                    <img 
                      src="/tokens/link.png" 
                      alt="LINK Token" 
                      className="w-4 h-4 rounded-full shadow-sm border border-white/40"
                      onError={(e) => {
                        // Fallback to styled div if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.className = 'flex items-center justify-center w-4 h-4 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full shadow-sm border border-white/40';
                        const icon = document.createElement('div');
                        icon.innerHTML = '<svg class="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
                        fallback.appendChild(icon);
                        target.parentNode?.appendChild(fallback);
                      }}
                    />
                    <span className="font-body text-white/90 text-xs font-medium">{formatBalance(wallet.linkBalance)}</span>
                  </div>
                </div>

                {/* Visual Separator */}
                <div className="mx-3 w-px h-4 bg-white/40"></div>

                {/* Address + Logout Section */}
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-white/80 text-xs">{truncateAddress(wallet.address || '')}</span>
                  <button 
                onClick={onDisconnect}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <LogOut className="h-3 w-3 text-white/60 hover:text-white/90" />
                  </button>
                </div>
              </div>
            ) : (
              /* Not Connected State - Simple Login Button */
              <button
                onClick={onConnect}
                disabled={isConnecting || !hasWallet}
                className={`flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 transition-colors h-8 ${
                  !hasWallet || isConnecting 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-white/20 cursor-pointer'
                }`}
              >
                <LogIn className="h-4 w-4 text-white/80" />
                <span className="font-body text-white/90 text-sm font-medium">
                  {isConnecting 
                    ? 'Connecting...' 
                    : hasWallet 
                      ? 'Connect' 
                      : 'Connect (No Wallet)'
                  }
                </span>
              </button>
            )}
            
            {/* Admin Panel Toggle - Only show for owners */}
            {wallet.isOwner && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleAdminPanel}
                    className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 h-8 w-8 flex items-center justify-center hover:bg-white/20 transition-colors"
                  >
                    {isAdminPanelOpen ? (
                      <Unlock className="h-3 w-3 text-green-400" />
                    ) : (
                      <Lock className="h-3 w-3 text-red-400" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[9999]" side="bottom" sideOffset={5}>
                  <p className="font-body text-xs">
                    {isAdminPanelOpen ? 'Admin Panel: Unlocked' : 'Admin Panel: Locked'}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
              </div>
            </div>
      </header>
      {isModalOpen && (
        <NetworkSwitchingModal
          isOpen={isModalOpen}
          onClose={closeModal}
          availableChains={availableChains}
          currentChainId={currentChainId}
          onChainSelect={handleSwitchNetwork}
          isSwitching={isSwitching}
          switchError={switchError}
        />
      )}
    </TooltipProvider>
  )
}
