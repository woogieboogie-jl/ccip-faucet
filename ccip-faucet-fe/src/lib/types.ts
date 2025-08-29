// Wallet and authentication types
export interface WalletState {
  address: string | null
  isConnected: boolean
  isOwner: boolean
  nativeBalance: number  // Generic: was 'monBalance'
  linkBalance: number
}

// Token and faucet types
export interface TokenState {
  tankBalance: number
  maxTankBalance: number
  baseDripAmount: number
  currentDripAmount: number
  dripCooldownTime: number
  requestCooldownTime: number
  isDripLoading: boolean
  isRequestLoading: boolean
  isRefreshing: boolean // Show spinner when refreshing tank balance from contract
  contractAddress: string
  lowTankThreshold: number
}

export interface FaucetState {
  active: TokenState  // Generic: was 'mon'
  link: TokenState
  vaultActive: number  // Generic: was 'vaultMon'
  vaultLink: number
}

// Volatility data structure
export interface VolatilityData {
  score: number
  trend: "increasing" | "decreasing" | "stable"
  multiplier: number
  refillDecision: number
}

// CCIP Phase types - consolidated from all sources
// NOTE: Phase names are now generic and config-driven
// REMOVED: Obsolete CCIPPhase - now using CCIPRequestPhase only

// CCIP Status types - consolidated from all sources
export type CCIPStatus = 
  | "idle" 
  | "wallet_pending" 
  | "tx_pending" 
  | "ccip_processing" 
  | "success" 
  | "failed" 
  | "stuck"
  | "pending"  // For backward compatibility
  | "completed" // For backward compatibility

// NEW: Failsafe CCIP State Machine Types (PRD v1.0)
export type CCIPRequestStatus = 'idle' | 'running' | 'success' | 'failed'
export type CCIPRequestPhase = 
  | 'request_clicked' 
  | 'request_confirmed' 
  | 'outbound_sent' 
  | 'outbound_received' 
  | 'inbound_sent' 
  | 'inbound_received'

// CCIP State Machine (PRD v1.0) - Failsafe CCIP monitoring
export interface CCIPRequest {
  status: "idle" | "running" | "success" | "failed"
  currentPhase: CCIPRequestPhase
  progress: number
  initialTxHash: string | null
  outboundMessageId: string | null
  responseMessageId: string | null
  errorMessage: string | null
  explorerUrls?: {
    outbound?: string
    inbound?: string
  }
}

// LEGACY: CCIP State Interface (for backward compatibility during transition)
export interface CCIPState {
  // Core status and progress
  status: CCIPStatus
  progress: number
  currentPhase?: CCIPRequestPhase
  lastUpdated: Date
  
  // Transaction tracking - Enhanced dual CCIP message support
  messageId?: string // Primary messageId (for backward compatibility)
  ccipMessageId?: string // Outbound message (Monad → Helper Chain)
  ccipResponseMessageId?: string // Inbound message (Helper Chain → Monad)
  monadTxHash?: string
  helperTxHash?: string // Generic: was avalancheTxHash
  transactionHash?: string // For backward compatibility
  
  // State management
  tankPercentage?: number
  isRefillNeeded?: boolean
  hasOutboundMessage?: boolean // indicates tx broadcast but real messageId not yet known
  
  // Results and completion data
  newDripAmount?: number
  refillAmount?: number
  volatilityData?: VolatilityData
  
  // Error handling
  errorMessage?: string
  stuckPhase?: string
}

// CONSOLIDATION: Global volatility state interface
export interface GlobalVolatilityState {
  multiplier: number
  lastUpdated: Date
  isUpdating: boolean
}

// CCIP Monitoring Configuration
export interface CCIPMonitorConfig {
  messageId: string
  tokenType: 'active' | 'link'  // Generic: was 'mon' | 'link'
  currentPhase: string
  onPhaseUpdate: (phase: string, progress: number, data?: any) => void
  onComplete: (result: any) => void
  onError: (error: string) => void
}

// CCIP Monitoring State
export interface CCIPMonitoringState {
  isActive: boolean
  lastBlockChecked: bigint
  failureCount: number
  nextCheckTime: number
}

// UI Component types
export type ButtonVariant = "primary" | "secondary" | "green" | "red" | "blue" | "orange"
export type ButtonState = "enabled" | "disabled" | "loading"
export type StatusLevel = "good" | "warning" | "critical"
export type AlertType = "info" | "success" | "warning" | "error"

// Status threshold types
export interface StatusThresholds {
  critical: number
  warning: number
}

// Button state types
export interface DripButtonState {
  text: string
  disabled: boolean
  isGasFree?: boolean
  isEmpty?: boolean
  loading?: boolean
}

export interface FuelButtonState {
  text: string
  disabled: boolean
  canRequest: boolean
}

export interface TankStatusState {
  status: string
  color: string
  isBelowThreshold: boolean
  threshold: number
  lastUpdated: Date
} 