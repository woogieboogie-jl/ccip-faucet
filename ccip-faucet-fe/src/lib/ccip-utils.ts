import { CCIPRequestPhase } from '@/lib/types'

// Phase configurations for the new 6-phase CCIP flow
export const CCIP_PHASES = {
  request_clicked: { progress: 0, description: 'User clicked refuel button' },
  request_confirmed: { progress: 5, description: 'Transaction confirmed on wallet' },
  outbound_sent: { progress: 10, description: 'CCIP message sent to Helper Chain' },
  outbound_received: { progress: 50, description: 'CCIP message received on Helper Chain' },
  inbound_sent: { progress: 80, description: 'Response sent back to Active Chain' },
  inbound_received: { progress: 100, description: 'Response received on Active Chain' },
} as const

export const getCCIPPhaseText = (phase: CCIPRequestPhase | undefined): string => {
  if (!phase) return 'Idle'
  return CCIP_PHASES[phase]?.description || 'Processing...'
}

export const getCCIPPhaseTooltip = (phase: CCIPRequestPhase | undefined): string => {
  if (!phase) return 'No active CCIP transaction'
  return CCIP_PHASES[phase]?.description || 'Processing CCIP transaction...'
}

export const getCCIPPhaseProgress = (phase: CCIPRequestPhase | undefined): number => {
  if (!phase) return 0
  return CCIP_PHASES[phase]?.progress || 0
}

// NEW: Configurable CCIP colors utility
export const getCCIPColors = (derivedConfig?: any) => {
  const chainlinkBlue = '#006FEE'
  const chainColor = derivedConfig?.primaryColor || '#8A5CF6'
  const gradientIntensity = 0.7 // Default from config
  
  // Mix Chainlink blue with chain color based on gradientIntensity
  const mixColor = (color1: string, color2: string, weight: number) => {
    const hex1 = color1.replace('#', '')
    const hex2 = color2.replace('#', '')
    const r1 = parseInt(hex1.substr(0, 2), 16)
    const g1 = parseInt(hex1.substr(2, 2), 16)
    const b1 = parseInt(hex1.substr(4, 2), 16)
    const r2 = parseInt(hex2.substr(0, 2), 16)
    const g2 = parseInt(hex2.substr(2, 2), 16)
    const b2 = parseInt(hex2.substr(4, 2), 16)
    
    const r = Math.round(r1 * (1 - weight) + r2 * weight)
    const g = Math.round(g1 * (1 - weight) + g2 * weight)
    const b = Math.round(b1 * (1 - weight) + b2 * weight)
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }
  
  // Create more elaborate and vibrant color variations
  const primaryMixed = mixColor(chainlinkBlue, chainColor, gradientIntensity)
  const secondaryMixed = mixColor(chainlinkBlue, chainColor, gradientIntensity * 0.8)
  const accentMixed = mixColor(chainlinkBlue, chainColor, gradientIntensity * 0.6)
  
  // Add vibrant accent colors for more elaborate effect
  const vibrantAccent1 = mixColor(primaryMixed, '#FF6B6B', 0.3) // Add coral tint
  const vibrantAccent2 = mixColor(secondaryMixed, '#4ECDC4', 0.3) // Add teal tint
  const vibrantAccent3 = mixColor(accentMixed, '#45B7D1', 0.3) // Add sky blue tint
  
  return {
    background: `linear-gradient(90deg, ${primaryMixed}25 0%, ${secondaryMixed}25 50%, ${accentMixed}25 100%)`,
    border: `${primaryMixed}40`,
    shadow: `${primaryMixed}10`,
    text: primaryMixed,
    dots: [vibrantAccent1, vibrantAccent2, vibrantAccent3], // More elaborate colors
    progressBar: `linear-gradient(90deg, ${primaryMixed}20 0%, ${secondaryMixed}20 50%, ${accentMixed}20 100%)`
  }
}

/**
 * Get helper chain CCIP colors using the same consolidated approach
 */
export const getHelperCCIPColors = (helperThemeColor: string) => {
  const chainlinkBlue = '#006FEE'
  const gradientIntensity = 0.7 // Default from config
  
  // Mix Chainlink blue with helper chain color based on gradientIntensity
  const mixColor = (color1: string, color2: string, weight: number) => {
    const hex1 = color1.replace('#', '')
    const hex2 = color2.replace('#', '')
    const r1 = parseInt(hex1.substr(0, 2), 16)
    const g1 = parseInt(hex1.substr(2, 2), 16)
    const b1 = parseInt(hex1.substr(4, 2), 16)
    const r2 = parseInt(hex2.substr(0, 2), 16)
    const g2 = parseInt(hex2.substr(2, 2), 16)
    const b2 = parseInt(hex2.substr(4, 2), 16)
    
    const r = Math.round(r1 * (1 - weight) + r2 * weight)
    const g = Math.round(g1 * (1 - weight) + g2 * weight)
    const b = Math.round(b1 * (1 - weight) + b2 * weight)
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }
  
  // Create helper chain mixed color using same approach as getCCIPColors
  const helperMixed = mixColor(chainlinkBlue, helperThemeColor, gradientIntensity)
  
  return {
    text: helperMixed, // Helper chain primary color for icons
  }
}

/**
 * Check if a CCIP phase is considered "active" (in progress)
 */
export const isCCIPPhaseActive = (status?: string): boolean => {
  return status === "tx_pending" || 
         status === "ccip_processing" || 
         status === "wallet_pending"
}

/**
 * Get the next expected phase in the CCIP flow
 */
export const getNextCCIPPhase = (currentPhase?: string): string | null => {
  switch (currentPhase) {
    case "wallet_confirm":
      return "monad_confirm"
    case "monad_confirm":
      return "ccip_pending"
    case "ccip_pending":
      return "ccip_confirmed"
    case "ccip_confirmed":
      return "helper_confirm"  // Generic: was "avalanche_confirm"
    case "helper_confirm":  // Generic: was "avalanche_confirm"
      return "ccip_response"
    case "ccip_response":
      return "monad_refill"
    case "monad_refill":
      return null // Final phase
    default:
      return null
  }
} 