import { CopyButton } from "@/components/ui/copy-button"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { getConfigExplorerUrl } from "@/lib/config"
import React from "react"

interface ContractAddressProps {
  address: string
  label?: string
  explorerUrl?: string
  truncate?: boolean
  className?: string
  variant?: "default" | "minimal"
  chain?: 'active' | 'helper'  // Generic: was 'monad' | 'avalanche'
}

export function ContractAddress({
  address,
  label = "Contract:",
  explorerUrl,
  truncate = true,
  className,
  variant = "default",
  chain = 'active'  // Generic: was 'monad'
}: ContractAddressProps) {
  const displayAddress = truncate 
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address

  // Use config-driven explorer URL if no custom URL provided
  const [finalExplorerUrl, setFinalExplorerUrl] = React.useState<string>('')
  
  React.useEffect(() => {
    const getExplorerUrl = async () => {
      if (explorerUrl) {
        setFinalExplorerUrl(explorerUrl)
      } else {
        try {
          const url = await getConfigExplorerUrl(chain, 'contract', address)
          setFinalExplorerUrl(url)
        } catch (error) {
          console.error('Failed to get config explorer URL:', error)
          // Fallback to a default URL
          setFinalExplorerUrl('#')
        }
      }
    }
    getExplorerUrl()
  }, [explorerUrl, chain, address])

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <code className="font-mono text-white text-xs">{displayAddress}</code>
        <div className="flex space-x-1">
          <CopyButton text={address} size="sm" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(finalExplorerUrl, "_blank")}
                className="h-8 w-8 p-1 hover:bg-white/20 hover:scale-110 transition-all duration-200 ease-in-out"
              >
                <ExternalLink className="h-3.5 w-3.5 text-white hover:text-white transition-all duration-200 filter hover:brightness-125 hover:drop-shadow-sm" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
              <p className="font-body text-xs">View on explorer</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("bg-white/5 rounded-lg p-2 flex items-center justify-between", className)}>
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        <span className="font-body text-white/70 text-xs font-medium whitespace-nowrap">
          {label}
        </span>
        <code className="font-mono text-white text-xs truncate flex-1">
          {displayAddress}
        </code>
      </div>
      <div className="flex space-x-1 ml-2">
        <CopyButton text={address} tooltipText="Copy address" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => window.open(finalExplorerUrl, "_blank")}
              className="h-8 w-8 p-1 hover:bg-white/20 hover:scale-110 transition-all duration-200 ease-in-out rounded"
            >
              <ExternalLink className="h-3.5 w-3.5 text-white hover:text-white transition-all duration-200 filter hover:brightness-125 hover:drop-shadow-sm" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
            <p className="font-body text-xs">View on explorer</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
} 
