import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Address utilities
export function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address) return ""
  return `${address.slice(0, start)}...${address.slice(-end)}`
}

// Number formatting utilities
export function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatBalance(value: number | bigint | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return "0.00"
  
  const num = typeof value === "bigint" ? Number(value) : value
  
  if (isNaN(num)) return "0.00"
  
  return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// Time utilities
export function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes === 1) return "1 minute ago"
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours === 1) return "1 hour ago"
  return `${diffInHours} hours ago`
}

export function formatCooldown(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

// Validation utilities
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount)
  return !isNaN(num) && num > 0
}

// Clipboard utilities
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error("Failed to copy:", error)
    return false
  }
} 