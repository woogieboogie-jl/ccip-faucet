import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { TokenState, CCIPState, CCIPRequest, CCIPRequestPhase, VolatilityData } from '@/lib/types'


// CONSOLIDATION: Remove unused legacy globalCCIP state
interface FaucetStoreState {
  // Token states - Generic: was 'mon' | 'link'
  tokens: {
    active: TokenState  // Generic: was 'mon' (native token)
    link: TokenState    // LINK token (always LINK)
  }
  
  // CCIP states - using unified interface - Generic: was 'mon' | 'link'
  ccip: {
    active: CCIPState  // Generic: was 'mon' (native token)
    link: CCIPState    // LINK token (always LINK)
  }
  
  // NEW: Failsafe CCIP State Machine (PRD v1.0)
  ccipRequest: CCIPRequest
  
  // Vault balances - Generic: was 'mon' | 'link'
  vaults: {
    active: number  // Generic: was 'mon'
    link: number
  }
  
  // Smart polling state management
  polling: {
    state: 'idle' | 'normal' | 'critical'
    lastContractCheck: number
    lastBalanceUpdate: number
    activeMonitors: string[]
    // RPC EFFICIENCY: Track last RPC calls to prevent duplicates
    lastRpcCalls: {
      contractRefillState: number
      tankBalance: number
      ccipEvents: number
      helperEvents: number
    }
  }
  
  // Volatility data
  volatility: {
    score: number
    trend: "increasing" | "decreasing" | "stable"
    multiplier: number
    lastUpdated: Date
    isUpdating: boolean
  }
  
  // Address management for multi-chain support
  addresses: Record<string, any>
  
  // UI states
  ui: {
    copiedAddresses: Record<string, boolean>
    dripStates: Record<string, boolean>
    isGasFreeModalOpen: boolean
  }
}

interface FaucetActions {
  // Token operations - Generic: was 'mon' | 'link'
  updateTokenState: (token: 'active' | 'link', updates: Partial<TokenState>) => void
  updateTokenBalance: (token: 'active' | 'link', balance: number) => void
  setDripLoading: (token: 'active' | 'link', loading: boolean) => void
  
  // CCIP operations - Generic: was 'mon' | 'link'
  updateCCIPState: (token: 'active' | 'link', updates: Partial<CCIPState>) => void
  resetCCIPState: (token: 'active' | 'link') => void
  
  // CONSOLIDATION: Enhanced CCIP operations for complete state management
  setCCIPProgress: (token: 'active' | 'link', progress: number, phase?: CCIPRequestPhase) => void
  setCCIPResult: (token: 'active' | 'link', result: { newDripAmount?: number; refillAmount?: number; volatilityData?: VolatilityData }) => void
  setCCIPError: (token: 'active' | 'link', error: string, stuckPhase?: string) => void
  
  // Vault operations - Generic: was 'mon' | 'link'
  updateVaultBalance: (token: 'active' | 'link', balance: number) => void
  
  // Smart polling operations
  setPollingState: (state: 'idle' | 'normal' | 'critical') => void
  updateLastContractCheck: (timestamp: number) => void
  updateLastBalanceUpdate: (timestamp: number) => void
  addActiveMonitor: (monitorId: string) => void
  removeActiveMonitor: (monitorId: string) => void
  
  // RPC EFFICIENCY: Prevent duplicate RPC calls
  canMakeRpcCall: (callType: 'contractRefillState' | 'tankBalance' | 'ccipEvents' | 'helperEvents', minInterval?: number) => boolean
  updateLastRpcCall: (callType: 'contractRefillState' | 'tankBalance' | 'ccipEvents' | 'helperEvents') => void
  
  // Volatility operations
  updateVolatility: (updates: Partial<FaucetStoreState['volatility']>) => void
  
  // CONSOLIDATION: Volatility utility functions (moved from useVolatility hook)
  getDripMultiplier: () => number
  getVolatilityLevel: () => string
  getVolatilityColor: () => string
  getDripReasoning: () => string
  updateVolatilityScore: (newScore: number) => void
  
  // Address management operations
  loadAddresses: () => Promise<void>
  updateAddresses: (addresses: Record<string, any>) => void
  clearAddresses: () => void
  
  // UI operations
  setCopiedAddress: (address: string, copied: boolean) => void
  setDripState: (token: string, active: boolean) => void
  setGasFreeModalOpen: (open: boolean) => void
  
  // Batch operations - Generic: was mon/link
  batchUpdateTokens: (updates: { active?: Partial<TokenState>, link?: Partial<TokenState> }) => void
  
  // Centralized cooldown management
  startCooldownTimer: () => void
  stopCooldownTimer: () => void
  updateCooldowns: () => void
  
  // Reset operations
  resetAllStates: () => void
  
  // NEW: Failsafe CCIP State Machine Actions (PRD v1.0)
  setCCIPRequestState: (updates: Partial<CCIPRequest>) => void
  resetCCIPRequest: () => void
  initiateCCIPRefill: () => Promise<void>
  startCCIPMonitoring: (initialTxHash: string) => void
}

const initialTokenState: TokenState = {
  tankBalance: 0,
  maxTankBalance: 100, // Updated default capacity
  baseDripAmount: 0,
  currentDripAmount: 0,
  dripCooldownTime: 0,
  requestCooldownTime: 0,
  isDripLoading: false,
  isRequestLoading: false,
  isRefreshing: false,
  contractAddress: '',
  lowTankThreshold: 30, // 30% of capacity
}

const initialCCIPState: CCIPState = {
  status: "idle",
  progress: 0,
  lastUpdated: new Date(),
  ccipResponseMessageId: undefined,
}

const initialState: FaucetStoreState = {
  tokens: {
    active: { ...initialTokenState },
    link: { ...initialTokenState },
  },
  ccip: {
    active: { ...initialCCIPState },
    link: { ...initialCCIPState },
  },
  ccipRequest: {
    status: "idle",
    currentPhase: "request_clicked",
    progress: 0,
    initialTxHash: null,
    outboundMessageId: null,
    responseMessageId: null,
    errorMessage: null,
  },
  vaults: {
    active: 0,
    link: 0,
  },
  polling: {
    state: 'idle',
    lastContractCheck: 0,
    lastBalanceUpdate: 0,
    activeMonitors: [],
    lastRpcCalls: {
      contractRefillState: 0,
      tankBalance: 0,
      ccipEvents: 0,
      helperEvents: 0,
    },
  },
  volatility: {
    score: 60, // Default neutral score (configurable)
    trend: "stable",
    multiplier: 1,
    lastUpdated: new Date(),
    isUpdating: false,
  },
  addresses: {},
  ui: {
    copiedAddresses: {},
    dripStates: {},
    isGasFreeModalOpen: false,
  },
}

// Global cooldown timer reference
let cooldownInterval: NodeJS.Timeout | null = null

// State validation and cleanup function
const validateAndCleanupPersistedState = (state: FaucetStoreState) => {
  // Validate CCIP states
  const tokens: ('active' | 'link')[] = ['active', 'link']
  tokens.forEach(token => {
    const ccipState = state.ccip[token]
    
    // Reset invalid states
    if (ccipState.status === 'idle' && ccipState.progress > 0) {
      console.log(`🧹 Cleaning up invalid ${token} CCIP state: idle with progress`)
      ccipState.progress = 0
      ccipState.currentPhase = undefined
    }
    
    // Reset stale states older than 1 hour
    if (ccipState.lastUpdated && Date.now() - ccipState.lastUpdated.getTime() > 60 * 60 * 1000) {
      console.log(`🧹 Cleaning up stale ${token} CCIP state: older than 1 hour`)
      ccipState.status = 'idle'
      ccipState.progress = 0
      ccipState.currentPhase = undefined
      ccipState.errorMessage = undefined
    }
    
    // Ensure Date objects are properly restored
    if (ccipState.lastUpdated && typeof ccipState.lastUpdated === 'string') {
      ccipState.lastUpdated = new Date(ccipState.lastUpdated)
    }
  })
  
  // Validate volatility state
  if (state.volatility.lastUpdated && typeof state.volatility.lastUpdated === 'string') {
    state.volatility.lastUpdated = new Date(state.volatility.lastUpdated)
  }
}

export const useFaucetStore = create<FaucetStoreState & FaucetActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState,
          
          // Token operations
          updateTokenState: (token, updates) =>
            set((state) => {
              // DEBUG: Monitor cooldown state changes
              if (updates.dripCooldownTime !== undefined) {
                console.log(`🔄 Cooldown state change for ${token}:`, {
                  oldValue: state.tokens[token].dripCooldownTime,
                  newValue: updates.dripCooldownTime,
                  timestamp: new Date().toISOString()
                })
              }
              
              console.log(`🔄 updateTokenState called for ${token}:`, updates)
              console.log(`📊 Before update - ${token} state:`, state.tokens[token])
              Object.assign(state.tokens[token], updates)
              console.log(`📊 After update - ${token} state:`, state.tokens[token])
            }),
            
          updateTokenBalance: (token, balance) =>
            set((state) => {
              state.tokens[token].tankBalance = balance
            }),
            
          setDripLoading: (token, loading) =>
            set((state) => {
              state.tokens[token].isDripLoading = loading
            }),
          
          // CCIP operations
          updateCCIPState: (token, updates) =>
            set((state) => {
              Object.assign(state.ccip[token], updates, { lastUpdated: new Date() })
            }),
            
          resetCCIPState: (token) =>
            set((state) => {
              state.ccip[token] = { ...initialCCIPState }
            }),
          
          // CONSOLIDATION: Enhanced CCIP operations for complete state management
          setCCIPProgress: (token, progress, phase) =>
            set((state) => {
              state.ccip[token].progress = progress
              if (phase) state.ccip[token].currentPhase = phase
            }),
          
          setCCIPResult: (token, result) =>
            set((state) => {
              state.ccip[token].newDripAmount = result.newDripAmount
              state.ccip[token].refillAmount = result.refillAmount
              state.ccip[token].volatilityData = result.volatilityData
            }),
          
          setCCIPError: (token, error, stuckPhase) =>
            set((state) => {
              state.ccip[token].status = "failed"
              state.ccip[token].errorMessage = error
              state.ccip[token].stuckPhase = stuckPhase
            }),
          
          // Vault operations - Generic: was 'mon' | 'link'
          updateVaultBalance: (token, balance) =>
            set((state) => {
              state.vaults[token] = balance
            }),
          
          // Smart polling operations
          setPollingState: (pollingState) =>
            set((state) => {
              state.polling.state = pollingState
            }),
          updateLastContractCheck: (timestamp) =>
            set((state) => {
              state.polling.lastContractCheck = timestamp
            }),
          updateLastBalanceUpdate: (timestamp) =>
            set((state) => {
              state.polling.lastBalanceUpdate = timestamp
            }),
          addActiveMonitor: (monitorId) =>
            set((state) => {
              state.polling.activeMonitors.push(monitorId)
            }),
          removeActiveMonitor: (monitorId) =>
            set((state) => {
              state.polling.activeMonitors = state.polling.activeMonitors.filter(id => id !== monitorId)
            }),
          
          // RPC EFFICIENCY: Prevent duplicate RPC calls
          canMakeRpcCall: (callType, minInterval = 5000) => {
            const state = get()
            const lastCall = state.polling.lastRpcCalls[callType]
            const now = Date.now()
            return now - lastCall >= minInterval
          },
          
          updateLastRpcCall: (callType) =>
            set((state) => {
              state.polling.lastRpcCalls[callType] = Date.now()
            }),
          
          // Volatility operations
          updateVolatility: (updates) =>
            set((state) => {
              Object.assign(state.volatility, updates)
            }),
          
          // CONSOLIDATION: Volatility utility functions (moved from useVolatility hook)
          getDripMultiplier: () => {
            const state = get()
            // Calculate multiplier based on actual contract data
            const activeMultiplier = state.tokens.active.baseDripAmount > 0 
              ? state.tokens.active.currentDripAmount / state.tokens.active.baseDripAmount 
              : 1
            const linkMultiplier = state.tokens.link.baseDripAmount > 0 
              ? state.tokens.link.currentDripAmount / state.tokens.link.baseDripAmount 
              : 1
            
            // Return the average multiplier (both tokens should have the same multiplier)
            return (activeMultiplier + linkMultiplier) / 2
          },
          
          getVolatilityLevel: () => {
            const state = get()
            const score = state.volatility.score
            if (score <= 20) return "Very Low"
            if (score <= 40) return "Low"
            if (score <= 60) return "Medium"
            if (score <= 80) return "High"
            return "Very High"
          },
          
          getVolatilityColor: () => {
            const state = get()
            const score = state.volatility.score
            if (score <= 20) return "text-green-400"
            if (score <= 40) return "text-green-300"
            if (score <= 60) return "text-yellow-400"
            if (score <= 80) return "text-orange-400"
            return "text-red-400"
          },
          
          getDripReasoning: () => {
            const state = get()
            const score = state.volatility.score
            if (score <= 20) return "Very low volatility - reduced drip rates to preserve reserves"
            if (score <= 40) return "Low volatility - slightly reduced drip rates for conservative distribution"
            if (score <= 60) return "Medium volatility - standard drip rates maintained"
            if (score <= 80) return "High volatility - increased drip rates due to market uncertainty"
            return "Very high volatility - maximum drip rates to support users during volatile periods"
          },
          
          updateVolatilityScore: (newScore) =>
            set((state) => {
              const currentScore = state.volatility.score
              let trend: "increasing" | "decreasing" | "stable" = "stable"
              if (newScore > currentScore + 5) trend = "increasing"
              else if (newScore < currentScore - 5) trend = "decreasing"
              
              state.volatility.score = Math.max(1, Math.min(100, newScore))
              state.volatility.trend = trend
              // REMOVED: Incorrect multiplier calculation - multiplier should be calculated from actual drip rates
              // state.volatility.multiplier = 1.0 + (newScore - 50) / 100
              state.volatility.lastUpdated = new Date()
            }),
          
          // Address management operations
          loadAddresses: async () => {
            try {
              const { getAddresses } = await import('../lib/config/chain/addresses')
              const addresses = await getAddresses()
              console.log('🏪 Addresses loaded into Zustand store:', addresses)
              set((state) => {
                state.addresses = addresses
              })
            } catch (error) {
              console.error('❌ Failed to load addresses into Zustand store:', error)
            }
          },
          
          updateAddresses: (addresses) =>
            set((state) => {
              state.addresses = addresses
            }),
          
          clearAddresses: () =>
            set((state) => {
              state.addresses = {}
            }),
          
          // UI operations
          setCopiedAddress: (address, copied) =>
            set((state) => {
              state.ui.copiedAddresses[address] = copied
            }),
            
          setDripState: (token, active) =>
            set((state) => {
              state.ui.dripStates[token] = active
            }),
            
          setGasFreeModalOpen: (open) =>
            set((state) => {
              state.ui.isGasFreeModalOpen = open
            }),
          
          // Batch operations
          batchUpdateTokens: (updates) =>
            set((state) => {
              if (updates.active) Object.assign(state.tokens.active, updates.active)
              if (updates.link) Object.assign(state.tokens.link, updates.link)
            }),
          
          // PHASE 4C: Optimized cooldown management
          startCooldownTimer: () => {
            if (cooldownInterval) return // Already running
            
            cooldownInterval = setInterval(() => {
              const state = get()
              const hasMonCooldowns = state.tokens.active.dripCooldownTime > 0 || state.tokens.active.requestCooldownTime > 0
              const hasLinkCooldowns = state.tokens.link.dripCooldownTime > 0 || state.tokens.link.requestCooldownTime > 0
              
              if (!hasMonCooldowns && !hasLinkCooldowns) {
                // Auto-stop timer when no cooldowns are active
                if (cooldownInterval) {
                  clearInterval(cooldownInterval)
                  cooldownInterval = null
                }
                return
              }
              
              // Update cooldowns
              state.updateCooldowns()
            }, 1000)
          },
          
          stopCooldownTimer: () => {
            if (cooldownInterval) {
              clearInterval(cooldownInterval)
              cooldownInterval = null
            }
          },
          
          updateCooldowns: () =>
            set((state) => {
              // Check if any cooldowns are active
              const hasMonCooldowns = state.tokens.active.dripCooldownTime > 0 || state.tokens.active.requestCooldownTime > 0
              const hasLinkCooldowns = state.tokens.link.dripCooldownTime > 0 || state.tokens.link.requestCooldownTime > 0
              
              // DEBUG: Log cooldown updates
              if (hasMonCooldowns || hasLinkCooldowns) {
                console.log(`⏱️ Cooldown timer tick:`, {
                  active: {
                    drip: state.tokens.active.dripCooldownTime,
                    request: state.tokens.active.requestCooldownTime
                  },
                  link: {
                    drip: state.tokens.link.dripCooldownTime,
                    request: state.tokens.link.requestCooldownTime
                  },
                  timestamp: new Date().toISOString()
                })
              }
              
              // If no cooldowns are active, stop the timer to save resources
              if (!hasMonCooldowns && !hasLinkCooldowns) {
                if (cooldownInterval) {
                  clearInterval(cooldownInterval)
                  cooldownInterval = null
                  console.log('⏹️ Auto-stopping cooldown timer (no active cooldowns)')
                }
                return // Don't update state if no cooldowns
              }
              
              // Update cooldowns
              if (hasMonCooldowns) {
                state.tokens.active.dripCooldownTime = Math.max(0, state.tokens.active.dripCooldownTime - 1)
                state.tokens.active.requestCooldownTime = Math.max(0, state.tokens.active.requestCooldownTime - 1)
              }
              
              if (hasLinkCooldowns) {
                state.tokens.link.dripCooldownTime = Math.max(0, state.tokens.link.dripCooldownTime - 1)
                state.tokens.link.requestCooldownTime = Math.max(0, state.tokens.link.requestCooldownTime - 1)
              }
            }),
          
          // Reset operations
          resetAllStates: () =>
            set((state) => {
              // Reset all states to initial values
              state.tokens = { ...initialState.tokens }
              state.ccip = { ...initialState.ccip }
              state.ccipRequest = { ...initialState.ccipRequest } // Ensure ccipRequest is reset
              state.vaults = { ...initialState.vaults }
              state.polling = { ...initialState.polling }
              state.volatility = { ...initialState.volatility }
              state.ui = { ...initialState.ui }
            }),
          
          // NEW: Failsafe CCIP State Machine Actions (PRD v1.0)
          setCCIPRequestState: (updates) =>
            set((state) => {
              Object.assign(state.ccipRequest, updates)
            }),
          
          resetCCIPRequest: () =>
            set((state) => {
              state.ccipRequest = {
                status: "idle",
                currentPhase: "request_clicked",
                progress: 0,
                initialTxHash: null,
                outboundMessageId: null,
                responseMessageId: null,
                errorMessage: null,
              }
            }),
          
          initiateCCIPRefill: async () => {
            // Set initial state for refill process
            set((state) => {
              state.ccipRequest.status = 'running'
              state.ccipRequest.currentPhase = 'request_clicked'
              state.ccipRequest.progress = 0
              state.ccipRequest.errorMessage = null
            })
            
            console.log('🚀 Initiating CCIP refill process...')
          },
          
          startCCIPMonitoring: (initialTxHash) => {
            set((state) => {
              state.ccipRequest.initialTxHash = initialTxHash
              state.ccipRequest.currentPhase = 'request_confirmed'
              state.ccipRequest.progress = 5
            })
            console.log(`🔔 CCIP monitoring started for transaction: ${initialTxHash}`)
          },
        }))
      ),
      {
        name: 'faucet-store',
        // PHASE 4C: Optimized persistence - only persist essential data
        partialize: (state) => {
          // Safety check: ensure state is properly initialized
          if (!state || 
              !state.ccip || 
              !state.ccip.active || 
              !state.ccip.link ||
              !state.volatility ||
              !state.tokens ||
              !state.tokens.active ||
              !state.tokens.link) {
            console.warn('⚠️ Store state not fully initialized, skipping persistence', {
              hasState: !!state,
              hasCcip: !!state?.ccip,
              hasCcipActive: !!state?.ccip?.active,
              hasCcipLink: !!state?.ccip?.link,
              hasVolatility: !!state?.volatility,
              hasTokens: !!state?.tokens,
              hasTokensActive: !!state?.tokens?.active,
              hasTokensLink: !!state?.tokens?.link,
            })
            return {}
          }
          
          return {
            // Only persist essential long-term data
            volatility: {
              score: state.volatility.score,
              trend: state.volatility.trend,
              multiplier: state.volatility.multiplier,
              lastUpdated: state.volatility.lastUpdated,
              // Don't persist isUpdating (transient state)
            },
            // NEW: Persist the failsafe CCIP state machine
            ccipRequest: {
              status: state.ccipRequest.status,
              currentPhase: state.ccipRequest.currentPhase,
              progress: state.ccipRequest.progress,
              initialTxHash: state.ccipRequest.initialTxHash,
              outboundMessageId: state.ccipRequest.outboundMessageId,
              responseMessageId: state.ccipRequest.responseMessageId,
              errorMessage: state.ccipRequest.errorMessage,
            },
            // CRITICAL FIX: Persist cooldown state to prevent loss on re-renders
            tokens: {
              active: {
                dripCooldownTime: state.tokens.active.dripCooldownTime,
                requestCooldownTime: state.tokens.active.requestCooldownTime,
                // Don't persist other token state (will be refreshed from contract)
              },
              link: {
                dripCooldownTime: state.tokens.link.dripCooldownTime,
                requestCooldownTime: state.tokens.link.requestCooldownTime,
                // Don't persist other token state (will be refreshed from contract)
              },
            },
            ccip: {
              active: {  // Generic: was 'mon'
                status: state.ccip.active.status,
                progress: state.ccip.active.progress,
                currentPhase: state.ccip.active.currentPhase,
                ccipMessageId: state.ccip.active.ccipMessageId,
                ccipResponseMessageId: state.ccip.active.ccipResponseMessageId,
                monadTxHash: state.ccip.active.monadTxHash,
                lastUpdated: state.ccip.active.lastUpdated, // CRITICAL: Persist lastUpdated
                errorMessage: state.ccip.active.errorMessage, // Persist error messages
                hasOutboundMessage: state.ccip.active.hasOutboundMessage, // Persist outbound flag
              },
              link: {
                status: state.ccip.link.status,
                progress: state.ccip.link.progress,
                currentPhase: state.ccip.link.currentPhase,
                ccipMessageId: state.ccip.link.ccipMessageId,
                ccipResponseMessageId: state.ccip.link.ccipResponseMessageId,
                monadTxHash: state.ccip.link.monadTxHash,
                lastUpdated: state.ccip.link.lastUpdated, // CRITICAL: Persist lastUpdated
                errorMessage: state.ccip.link.errorMessage, // Persist error messages
                hasOutboundMessage: state.ccip.link.hasOutboundMessage, // Persist outbound flag
              },
            },
            // Don't persist vaults (will be refreshed from contract)
            // Don't persist ui (transient state)
          }
        },
        // PHASE 4C: Add storage event handling for better multi-tab sync
        onRehydrateStorage: () => (state) => {
          if (state) {
            console.log('🔄 Zustand state rehydrated:', state)
            
            // DEBUG: Log cooldown state restoration
            if (state.tokens) {
              console.log('⏱️ Cooldown state restored from localStorage:', {
                active: {
                  dripCooldown: state.tokens.active?.dripCooldownTime,
                  requestCooldown: state.tokens.active?.requestCooldownTime
                },
                link: {
                  dripCooldown: state.tokens.link?.dripCooldownTime,
                  requestCooldown: state.tokens.link?.requestCooldownTime
                }
              })
            }
            
            // Validate and clean up persisted state
            validateAndCleanupPersistedState(state)
            
            // Restore lastUpdated dates after rehydration
            if (state.volatility?.lastUpdated && typeof state.volatility.lastUpdated === 'string') {
              state.volatility.lastUpdated = new Date(state.volatility.lastUpdated)
            }
            if (state.ccip?.active?.lastUpdated && typeof state.ccip.active.lastUpdated === 'string') {
              state.ccip.active.lastUpdated = new Date(state.ccip.active.lastUpdated)
            }
            if (state.ccip?.link?.lastUpdated && typeof state.ccip.link.lastUpdated === 'string') {
              state.ccip.link.lastUpdated = new Date(state.ccip.link.lastUpdated)
            }
          }
        },
      }
    ),
    { 
      name: 'faucet-store',
      // PHASE 4C: Optimize devtools for production
      enabled: process.env.NODE_ENV === 'development',
    }
  )
)

// Selectors for better performance
export const useTokenState = (token: 'active' | 'link') =>
  useFaucetStore((state) => state.tokens[token])

export const useCCIPState = (token: 'active' | 'link') =>
  useFaucetStore((state) => state.ccip[token])

export const useVolatilityState = () =>
  useFaucetStore((state) => state.volatility)

export const useVaultState = () =>
  useFaucetStore((state) => state.vaults)

export const useUIState = () =>
  useFaucetStore((state) => state.ui)

// CONSOLIDATION: Volatility utility selectors (replacing useVolatility hook)
export const useVolatilityUtils = () =>
  useFaucetStore((state) => ({
    getDripMultiplier: state.getDripMultiplier,
    getVolatilityLevel: state.getVolatilityLevel,
    getVolatilityColor: state.getVolatilityColor,
    getDripReasoning: state.getDripReasoning,
    updateVolatilityScore: state.updateVolatilityScore,
  }))

export const useVolatilityData = () =>
  useFaucetStore((state) => ({
    volatility: {
      score: state.volatility.score,
      trend: state.volatility.trend,
      lastUpdate: state.volatility.lastUpdated,
      source: "BTC-based Crypto", // For compatibility with existing components
    },
    isLoading: state.volatility.isUpdating,
  }))

// Computed selectors
export const useTokenThresholdStatus = (token: 'active' | 'link') =>
  useFaucetStore((state) => {
    const tokenState = state.tokens[token]
    const percentage = (tokenState.tankBalance / tokenState.maxTankBalance) * 100
    const isLow = percentage < 30
    const isCritical = percentage < 10
    
    return { percentage, isLow, isCritical }
  })

export const useAnyRequestActive = () =>
  useFaucetStore((state) => 
    state.ccipRequest.status === 'running'
  )

// NEW: Failsafe CCIP State Machine Hook (PRD v1.0)
export const useCCIPRequest = () =>
  useFaucetStore((state) => state.ccipRequest)

// Address management selectors
export const useAddressState = () =>
  useFaucetStore((state) => state.addresses)

export const useAddressUtils = () =>
  useFaucetStore((state) => ({
    loadAddresses: state.loadAddresses,
    updateAddresses: state.updateAddresses,
    clearAddresses: state.clearAddresses,
  })) 