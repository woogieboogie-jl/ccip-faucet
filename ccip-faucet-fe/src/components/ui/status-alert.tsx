import { ReactNode } from "react"
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatusAlertProps {
  type: "info" | "success" | "warning" | "error"
  title: string
  message?: string
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

export function StatusAlert({
  type,
  title,
  message,
  icon,
  actions,
  className
}: StatusAlertProps) {
  const configs = {
    info: {
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/30",
      iconColor: "text-blue-400",
      textColor: "text-blue-400",
      defaultIcon: <Info className="h-4 w-4" />
    },
    success: {
      bgColor: "bg-green-500/20",
      borderColor: "border-green-500/30", 
      iconColor: "text-green-400",
      textColor: "text-green-400",
      defaultIcon: <CheckCircle className="h-4 w-4" />
    },
    warning: {
      bgColor: "bg-yellow-500/20",
      borderColor: "border-yellow-500/30",
      iconColor: "text-yellow-400", 
      textColor: "text-yellow-400",
      defaultIcon: <AlertTriangle className="h-4 w-4" />
    },
    error: {
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
      iconColor: "text-red-400",
      textColor: "text-red-400", 
      defaultIcon: <XCircle className="h-4 w-4" />
    }
  }

  const config = configs[type]

  return (
    <div className={cn(
      `${config.bgColor} border ${config.borderColor} rounded-lg p-3 flex items-start space-x-3`,
      className
    )}>
      <div className={cn(config.iconColor, "mt-0.5 flex-shrink-0")}>
        {icon || config.defaultIcon}
      </div>
      <div className="flex-1">
        <p className={cn("font-body font-semibold text-sm", config.textColor)}>
          {title}
        </p>
        {message && (
          <p className={cn("font-body text-xs mt-1", config.textColor.replace("400", "300"))}>
            {message}
          </p>
        )}
        {actions && (
          <div className="mt-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
} 