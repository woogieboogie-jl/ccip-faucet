import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { AlertTriangle, Fuel, Zap, Info } from "lucide-react"
import { formatBalance } from "@/lib/utils"
import { useFaucet } from "@/hooks/use-faucet"

interface TankStatusProps {
  isOwner: boolean
  derivedConfig?: {
    nativeSymbol: string
    nativeName: string
  } | null
}

export function TankStatus({ isOwner, derivedConfig }: TankStatusProps) {
  const { faucet, requestVolatilityAndRefill, formatCooldown, isTankLow } = useFaucet()

  // Minimum thresholds for tank refill trigger
  const MIN_TANK_THRESHOLDS = {
    active: 200, // Show fuel button when tank < 200
    link: 2000, // Show fuel button when LINK tank < 2000
  }

  const getTankStatusColor = (tankBalance: number, threshold: number) => {
    if (tankBalance < threshold) return "text-red-400"
    if (tankBalance < threshold * 2) return "text-yellow-400"
    return "text-green-400"
  }

  const getTankStatusText = (tankBalance: number, threshold: number) => {
    if (tankBalance < threshold) return "Critical"
    if (tankBalance < threshold * 2) return "Low"
    return "Healthy"
  }

  const getTankAlertLevel = (tankBalance: number, threshold: number) => {
    if (tankBalance < threshold) return "critical"
    if (tankBalance < threshold * 2) return "warning"
    return "healthy"
  }

  const renderTankAlert = (tokenType: "active" | "link", tankBalance: number, threshold: number) => {
    const alertLevel = getTankAlertLevel(tankBalance, threshold)

    if (alertLevel === "healthy") return null

    const alertConfig = {
      critical: {
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/30",
        iconColor: "text-red-400",
        textColor: "text-red-400",
        title: "Critical Tank Level",
        message: `${tokenType.toUpperCase()} tank is critically low. Use fuel button (🔋) to trigger vault→tank refill.`,
      },
      warning: {
        bgColor: "bg-yellow-500/20",
        borderColor: "border-yellow-500/30",
        iconColor: "text-yellow-400",
        textColor: "text-yellow-400",
        title: "Low Tank Level",
        message: `${tokenType.toUpperCase()} tank is running low. Use fuel button (🔋) to trigger vault→tank refill.`,
      },
    }

    const config = alertConfig[alertLevel as keyof typeof alertConfig]

    return (
      <div className={`${config.bgColor} border ${config.borderColor} rounded-lg p-3 flex items-start space-x-3`}>
        <AlertTriangle className={`h-4 w-4 ${config.iconColor} mt-0.5 flex-shrink-0`} />
        <div>
          <p className={`font-body ${config.textColor} font-semibold text-sm`}>{config.title}</p>
          <p className={`font-body ${config.textColor.replace("400", "300")} text-xs`}>{config.message}</p>
        </div>
      </div>
    )
  }

  const getFuelButtonState = (tokenType: "active" | "link") => {
    const token = faucet[tokenType]
    
    if (token.isRequestLoading) {
      return { text: "Processing CCIP...", disabled: true, loading: true }
    }
    
    if (token.requestCooldownTime > 0) {
      return { text: formatCooldown(token.requestCooldownTime), disabled: true }
    }
    
    if (!isTankLow(tokenType)) {
      return { text: "Tank Full", disabled: true }
    }
    
    return { text: "Refuel Tank", disabled: false }
  }

  return (
    <TooltipProvider>
    <Card className="bg-white/10 backdrop-blur-sm border-white/20">
      <CardContent className="space-y-4 lg:space-y-6 p-4 lg:p-6">
        {/* Tank Overview Header */}
        <div className="text-center mb-4">
          <h3 className="font-body font-semibold text-white text-lg lg:text-xl flex items-center justify-center space-x-2">
            <Fuel className="h-4 w-4 lg:h-5 lg:w-5" />
            <span>Tank Status</span>
          </h3>
          <p className="font-body text-white/70 text-sm mt-1">Active pools available for dripping to users</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
          {/* Native Token Tank */}
          <div className="bg-white/5 rounded-lg p-3 lg:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-body font-semibold text-white text-sm lg:text-lg">{derivedConfig?.nativeName || 'Native'} Tank</h4>
              <span
                className={`font-body text-xs font-medium lg:text-sm ${getTankStatusColor(faucet.active.tankBalance, MIN_TANK_THRESHOLDS.active)}`}
              >
                {getTankStatusText(faucet.active.tankBalance, MIN_TANK_THRESHOLDS.active)}
              </span>
              <span className="font-body text-white/90 text-sm lg:text-base">
                {formatBalance(faucet.active.tankBalance)} {derivedConfig?.nativeSymbol || 'NATIVE'}  {/* Generic: was MON */}
              </span>
              <span className="font-body text-white/50 text-xs">
                {faucet.active.tankBalance < MIN_TANK_THRESHOLDS.active
                  ? "Critical"
                  : faucet.active.tankBalance < MIN_TANK_THRESHOLDS.active * 2
                  ? "Low"
                  : "Good"
                }
              </span>
              <div className="w-full bg-white/10 rounded-full h-2 hover:bg-white/15 transition-colors duration-200">
                <div
                  className="bg-white/70 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (faucet.active.tankBalance / faucet.active.maxTankBalance) * 100)}%` }}
                />
              </div>
              <span className="font-body text-xs font-medium text-white/50">Max: {formatBalance(faucet.active.maxTankBalance)}</span>
            </div>

              {/* Enhanced Fuel Button for MON with Info Icon */}
            <div className="pt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
              <Button
                onClick={() => requestVolatilityAndRefill("active")}
                disabled={getFuelButtonState("active").disabled}
                      className="w-full fuel-button-enhanced bg-white/10 hover:bg-white/20 text-white font-body text-xs py-2 relative flex items-center justify-between"
              >
                      <div className="flex items-center space-x-2">
                        <Fuel className="h-3 w-3" />
                        <span>{getFuelButtonState("active").text}</span>
                      </div>
                      <Info className="h-3 w-3 opacity-60" />
              </Button>
                  </TooltipTrigger>
                  <TooltipContent className="tooltip-enhanced max-w-xs" side="top">
                    <div className="space-y-1">
                      <p className="font-body text-sm font-medium">Cross-Chain Tank Refill</p>
                      <p className="font-body text-xs text-white/80">
                        Triggers CCIP request to fetch volatility data and refill tank from vault reserves.
                      </p>
                      <p className="font-body text-xs text-white/60">
                        Current threshold: {formatBalance(MIN_TANK_THRESHOLDS.active)} {derivedConfig?.nativeSymbol || 'NATIVE'}  {/* Generic: was MON */}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
            </div>

            {/* Status Alert for MON Tank */}
            {renderTankAlert("active", faucet.active.tankBalance, MIN_TANK_THRESHOLDS.active)}
          </div>

          {/* LINK Tank */}
          <div className="bg-white/5 rounded-lg p-3 lg:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-body font-semibold text-white text-sm lg:text-lg">LINK Tank</h4>
              <span
                className={`font-body text-xs font-medium lg:text-sm ${getTankStatusColor(faucet.link.tankBalance, MIN_TANK_THRESHOLDS.link)}`}
              >
                {getTankStatusText(faucet.link.tankBalance, MIN_TANK_THRESHOLDS.link)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-body text-xs font-medium text-white/70 lg:text-sm">Available:</span>
                <span className="font-body font-medium text-white text-sm lg:text-base">
                  {formatBalance(faucet.link.tankBalance)} LINK
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 hover:bg-white/15 transition-colors duration-200">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    faucet.link.tankBalance < MIN_TANK_THRESHOLDS.link
                      ? "bg-red-400"
                      : faucet.link.tankBalance < MIN_TANK_THRESHOLDS.link * 2
                        ? "bg-yellow-400"
                        : "bg-green-400"
                  }`}
                  style={{ width: `${Math.min(100, (faucet.link.tankBalance / faucet.link.maxTankBalance) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-body text-xs font-medium text-white/50">Critical: {formatBalance(MIN_TANK_THRESHOLDS.link)}</span>
                <span className="font-body text-xs font-medium text-white/50">Max: {formatBalance(faucet.link.maxTankBalance)}</span>
              </div>
            </div>

              {/* Enhanced Fuel Button for LINK with Info Icon */}
            <div className="pt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
              <Button
                onClick={() => requestVolatilityAndRefill("link")}
                disabled={getFuelButtonState("link").disabled}
                      className="w-full fuel-button-enhanced bg-white/10 hover:bg-white/20 text-white font-body text-xs py-2 relative flex items-center justify-between"
              >
                      <div className="flex items-center space-x-2">
                        <Fuel className="h-3 w-3" />
                        <span>{getFuelButtonState("link").text}</span>
                      </div>
                      <Info className="h-3 w-3 opacity-60" />
              </Button>
                  </TooltipTrigger>
                  <TooltipContent className="tooltip-enhanced max-w-xs" side="top">
                    <div className="space-y-1">
                      <p className="font-body text-sm font-medium">Cross-Chain Tank Refill</p>
                      <p className="font-body text-xs text-white/80">
                        Triggers CCIP request to fetch volatility data and refill tank from vault reserves.
                      </p>
                      <p className="font-body text-xs text-white/60">
                        Current threshold: {formatBalance(MIN_TANK_THRESHOLDS.link)} LINK
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
            </div>

            {/* Status Alert for LINK Tank */}
            {renderTankAlert("link", faucet.link.tankBalance, MIN_TANK_THRESHOLDS.link)}
          </div>
        </div>

        {/* Refuel Process Explanation */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/20">
          <h4 className="font-body font-semibold text-white text-sm lg:text-base mb-2 flex items-center space-x-2">
            <Zap className="h-3 w-3 lg:h-4 lg:w-4 text-blue-400" />
            <span>How Refueling Works</span>
          </h4>
          <div className="space-y-2 text-xs lg:text-sm">
            <p className="font-body text-white/80">
              <span className="text-white font-medium">1. Fuel Button:</span> Triggers CCIP cross-chain request for volatility data
            </p>
            <p className="font-body text-white/80">
              <span className="text-white font-medium">2. Smart Refill:</span> Algorithm determines refill amount based on market volatility
            </p>
            <p className="font-body text-white/80">
              <span className="text-white font-medium">3. Vault→Tank:</span> Transfers tokens from vault reserves to active tank
            </p>
            {isOwner && (
              <p className="font-body text-blue-300 text-xs mt-2">
                <span className="font-medium">Admin:</span> You can monitor vault reserves in the Vault Status section above
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  )
} 