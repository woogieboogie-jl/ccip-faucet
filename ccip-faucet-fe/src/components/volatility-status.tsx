

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useTokenState } from "@/store/faucet-store"

interface VolatilityStatusProps {
  volatility: {
    score: number
    trend: "increasing" | "decreasing" | "stable"
    lastUpdate: Date
    source: string
  }
  getVolatilityLevel: () => string
  getDripMultiplier: () => number
}

export function VolatilityStatus({ volatility, getVolatilityLevel, getDripMultiplier }: VolatilityStatusProps) {
  // Get actual current drip amounts from the Zustand store for comparison
  const activeTokenState = useTokenState('active')  // Generic: was monTokenState and 'mon'
  const linkTokenState = useTokenState('link')
  
  // Universal volatility affects both tokens equally
  const universalVolatility = {
    score: volatility.score,
    trend: volatility.trend,
    multiplier: getDripMultiplier(),
    lastUpdated: volatility.lastUpdate
  }

  // Calculate individual token adjustments based on universal volatility
  const getTokenAdjustment = (tokenType: "active" | "link") => {  // Generic: was "mon" | "link"
    // Use actual base drip amounts from contract (stored in Zustand)
    const tokenState = tokenType === "active" ? activeTokenState : linkTokenState  // Generic: was "mon" and monTokenState
    const baseAmount = tokenState.baseDripAmount || 0
    const currentAmount = tokenState.currentDripAmount || 0
    const change = baseAmount > 0 ? ((currentAmount - baseAmount) / baseAmount) * 100 : 0
    return {
      baseAmount,
      adjustedAmount: currentAmount,
      change,
      volatilityScore: universalVolatility.score,
      volatilityLevel: getVolatilityLevel(),
    }
  }

  const activeData = getTokenAdjustment("active")  // Generic: was monData and "mon"
  const linkData = getTokenAdjustment("link")

  const getVolatilityColor = (score: number) => {
    if (score <= 20) return "text-green-400"
    if (score <= 40) return "text-green-300"
    if (score <= 60) return "text-yellow-400"
    if (score <= 80) return "text-orange-400"
    return "text-red-400"
  }

  return (
    <TooltipProvider>
    <Card className="bg-white/10 backdrop-blur-sm border-white/20">
      <CardContent className="space-y-4 lg:space-y-6 p-4 lg:p-6">
        {/* Overall Market Volatility */}
        <div className="text-center bg-white/5 rounded-lg p-3 lg:p-4">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <p className="font-body font-medium text-white/70 text-sm">Overall Market Volatility</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-white/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                  <p className="font-body text-xs">Higher volatility &rarr; faucet increases drip amount so you can keep building while markets move.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          <div className="flex items-center justify-center space-x-2">
              <p className={`font-body text-lg lg:text-xl font-bold ${getVolatilityColor(universalVolatility.score)}`}>
                {universalVolatility.score}
            </p>
            <p
                className={`font-body text-base lg:text-lg font-semibold ${getVolatilityColor(universalVolatility.score)}`}
            >
                ({getVolatilityLevel()})
            </p>
          </div>
        </div>

        {/* Individual Asset Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
          {/* MON Status */}
          <div className="bg-white/5 rounded-lg p-3 lg:p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-body font-semibold text-sm lg:text-base text-white">MON</span>
              <div className="flex items-center space-x-1">
                <span
                    className={`font-body text-sm font-bold ${getVolatilityColor(activeData.volatilityScore)}`}
                >
                    {activeData.volatilityScore}
                </span>
                <span
                    className={`font-body text-xs font-medium lg:text-sm ${getVolatilityColor(activeData.volatilityScore)}`}
                >
                    ({activeData.volatilityLevel})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body font-medium text-white/70 text-xs lg:text-sm">
                  Drip: {activeData.baseAmount} → {activeData.adjustedAmount} MON
              </span>
              <div className="flex items-center space-x-1">
                  {activeData.change > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                  ) : activeData.change < 0 ? (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                  ) : null}
                <span
                    className={`font-body text-xs font-medium ${
                      activeData.change > 0 ? "text-green-400" : 
                      activeData.change < 0 ? "text-red-400" : "text-white/70"
                    }`}
                >
                    {activeData.change > 0 ? "+" : ""}{activeData.change.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* LINK Status */}
          <div className="bg-white/5 rounded-lg p-3 lg:p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-body font-semibold text-sm lg:text-base text-white">LINK</span>
              <div className="flex items-center space-x-1">
                <span
                    className={`font-body text-sm font-bold ${getVolatilityColor(linkData.volatilityScore)}`}
                >
                    {linkData.volatilityScore}
                </span>
                <span
                    className={`font-body text-xs font-medium lg:text-sm ${getVolatilityColor(linkData.volatilityScore)}`}
                >
                    ({linkData.volatilityLevel})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body font-medium text-white/70 text-xs lg:text-sm">
                  Drip: {linkData.baseAmount} → {linkData.adjustedAmount} LINK
              </span>
              <div className="flex items-center space-x-1">
                  {linkData.change > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                  ) : linkData.change < 0 ? (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                  ) : null}
                <span
                    className={`font-body text-xs font-medium ${
                      linkData.change > 0 ? "text-green-400" : 
                      linkData.change < 0 ? "text-red-400" : "text-white/70"
                    }`}
                >
                    {linkData.change > 0 ? "+" : ""}{linkData.change.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Last Update */}
        <div className="text-center pt-3 lg:pt-4 border-t border-white/20">
            <p className="font-body text-xs font-medium text-white/50">Last updated: {volatility.lastUpdate.toLocaleTimeString()}</p>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  )
}
