import type React from "react"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  icon?: React.ReactNode
}

export function CollapsibleSection({ title, children, defaultOpen = true, icon }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Section Header - Simple div with click handler */}
      <div className="flex items-center justify-center mb-4">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-3 text-white hover:text-white/80 font-body font-medium text-base cursor-pointer transition-colors duration-200"
        >
          {icon}
          <span>{title}</span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 transition-transform duration-200" />
          ) : (
            <ChevronDown className="h-4 w-4 transition-transform duration-200" />
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  )
}
