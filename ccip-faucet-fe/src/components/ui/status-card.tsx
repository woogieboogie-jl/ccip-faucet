import { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface StatusCardProps {
  title: string
  status: "good" | "warning" | "critical"
  value: string | number
  maxValue?: string | number
  unit?: string
  subtitle?: string
  icon?: ReactNode
  tooltip?: string
  progress?: number
  actions?: ReactNode
  alerts?: ReactNode
  className?: string
}

export function StatusCard({
  title,
  status,
  value,
  maxValue,
  unit = "",
  subtitle,
  icon,
  tooltip,
  progress,
  actions,
  alerts,
  className
}: StatusCardProps) {
  const statusColors = {
    good: "text-green-400",
    warning: "text-yellow-400", 
    critical: "text-red-400"
  }

  const progressColors = {
    good: "bg-green-400",
    warning: "bg-yellow-400",
    critical: "bg-red-400"
  }

  const formatValue = (val: string | number) => {
    return typeof val === 'number' ? val.toLocaleString() : val
  }

  const content = (
    <div className="bg-white/5 rounded-lg p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {icon}
          <h4 className="font-body font-semibold text-white text-sm lg:text-lg">{title}</h4>
        </div>
        <span className={cn("font-body text-xs font-medium lg:text-sm", statusColors[status])}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-body text-xs font-medium text-white/70 lg:text-sm">
            {subtitle || "Balance:"}
          </span>
          <span className="font-body font-medium text-white text-sm lg:text-base">
            {formatValue(value)}{unit ? ` ${unit}` : ""}
            {maxValue && ` / ${formatValue(maxValue)}${unit ? ` ${unit}` : ""}`}
          </span>
        </div>

        {progress !== undefined && (
          <div className="w-full bg-white/10 rounded-full h-2 hover:bg-white/15 transition-colors duration-200">
            <div
              className="h-2 rounded-full transition-all duration-500 bg-white/70"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}
      </div>

      {actions && (
        <div className="pt-2">
          {actions}
        </div>
      )}

      {alerts}
    </div>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={className}>
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
          <p className="font-body text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return <div className={className}>{content}</div>
} 