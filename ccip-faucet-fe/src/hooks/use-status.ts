import { useMemo } from "react"

export type StatusLevel = "good" | "warning" | "critical"

interface StatusConfig {
  level: StatusLevel
  text: string
  color: string
  progress?: number // 0-100 for UI bars
}

/**
 * Decide vault/tank status based on dynamic thresholds derived from contract data.
 * @param value             Current balance
 * @param criticalThreshold Amount required for the next refill. `warning` is 10× this value.
 */
export function useStatus(value: number, criticalThreshold: number): StatusConfig {
  return useMemo(() => {
    // Safeguard against div-by-zero
    const crit = criticalThreshold === 0 ? 1 : criticalThreshold
    const warn = crit * 10

    // Helper to clamp progress to 0-100
    const pct = (num: number, denom: number) => Math.min(100, (num / denom) * 100)

    if (value < crit) {
      return {
        level: "critical",
        text: "Critical",
        color: "text-red-400",
        progress: pct(value, crit),
      }
    }

    if (value < warn) {
      return {
        level: "warning",
        text: "Low",
        color: "text-yellow-400",
        progress: pct(value, warn),
      }
    }

    return {
      level: "good",
      text: "Good",
      color: "text-green-400",
      progress: 100,
    }
  }, [value, criticalThreshold])
}

// Re-export utilities from lib/utils for convenience
export { formatCooldown, formatTimeAgo, formatNumber } from "@/lib/utils" 