import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
  text: string
  variant?: "default" | "ghost" | "outline"
  size?: "sm" | "md" | "lg"
  className?: string
  tooltipText?: string
  copiedText?: string
}

export function CopyButton({
  text,
  variant = "ghost",
  size = "sm",
  className,
  tooltipText = "Copy",
  copiedText = "Copied!"
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const sizeClasses = {
    sm: "h-8 w-8 p-1",
    md: "h-9 w-9 p-2", 
    lg: "h-10 w-10 p-2.5"
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          onClick={handleCopy}
          className={cn(
            sizeClasses[size],
            "transition-all duration-200 hover:bg-white/10",
            isCopied && "bg-green-500/20",
            className
          )}
        >
          {isCopied ? (
            <Check className="h-3 w-3 text-green-400" />
          ) : (
            <Copy className="h-3 w-3 text-white/70 hover:text-white/90 transition-colors duration-200" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
        <p className="font-body text-xs">{isCopied ? copiedText : tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  )
} 