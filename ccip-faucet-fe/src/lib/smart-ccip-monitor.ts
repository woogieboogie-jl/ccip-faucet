// Smart CCIP Monitoring System
// Phase 3B: Event-driven monitoring with intelligent intervals

import { publicClient } from '@/lib/viem'
import { Log } from 'viem'
import { parseAbi } from 'viem'
import { getFaucetAddress } from '@/lib/config/chain/addresses'

interface CCIPMonitorConfig {
  messageId: string
  tokenType: 'active' | 'link'
  currentPhase: string
  onPhaseUpdate: (phase: string, progress: number, data?: any) => void
  onComplete: (result: any) => void
  onError: (error: string) => void
}

interface MonitoringState {
  isActive: boolean
  lastBlockChecked: bigint
  failureCount: number
  nextCheckTime: number
}

class SmartCCIPMonitor {
  private monitors = new Map<string, MonitoringState>()
  private blockSubscription: any = null
  private isListening = false

  /**
   * Start smart monitoring for a CCIP transaction
   * Uses event-driven approach with adaptive intervals
   */
  async startMonitoring(config: CCIPMonitorConfig): Promise<void> {
    const monitorId = `${config.tokenType}-${config.messageId}`
    
    console.log(`🎯 Starting SMART CCIP monitoring for ${config.tokenType} (${config.messageId.slice(0, 10)}...)`)
    
    // Initialize monitoring state
    this.monitors.set(monitorId, {
      isActive: true,
      lastBlockChecked: await publicClient.getBlockNumber(),
      failureCount: 0,
      nextCheckTime: Date.now()
    })

    // Start block-based event listening if not already active
    if (!this.isListening) {
      this.startBlockListener()
    }

    // Start phase-specific monitoring
    this.monitorPhase(config)
  }

  /**
   * Stop monitoring for a specific transaction
   */
  stopMonitoring(tokenType: 'active' | 'link', messageId: string): void {
    const monitorId = `${tokenType}-${messageId}`
    const state = this.monitors.get(monitorId)
    
    if (state) {
      state.isActive = false
      this.monitors.delete(monitorId)
      console.log(`🛑 Stopped CCIP monitoring for ${tokenType}`)
    }

    // Stop block listener if no active monitors
    if (this.monitors.size === 0 && this.blockSubscription) {
      this.stopBlockListener()
    }
  }

  /**
   * Start listening to new blocks for event-driven updates
   */
  private startBlockListener(): void {
    if (this.isListening) return

    console.log('🔍 Starting smart block listener for CCIP events')
    this.isListening = true

    // Listen for new blocks to check for CCIP events
    this.blockSubscription = publicClient.watchBlocks({
      onBlock: (block) => {
        this.onNewBlock(block.number)
      },
      onError: (error) => {
        console.error('Block listener error:', error)
        // Restart listener after delay
        setTimeout(() => {
          if (this.monitors.size > 0) {
            this.startBlockListener()
          }
        }, 10000)
      }
    })
  }

  /**
   * Stop block listener
   */
  private stopBlockListener(): void {
    if (this.blockSubscription) {
      this.blockSubscription()
      this.blockSubscription = null
    }
    this.isListening = false
    console.log('🛑 Stopped block listener')
  }

  /**
   * Handle new block - check for relevant CCIP events
   */
  private async onNewBlock(blockNumber: bigint): Promise<void> {
    const activeMonitors = Array.from(this.monitors.entries()).filter(([_, state]) => state.isActive)
    
    if (activeMonitors.length === 0) return

    try {
      // Get logs for the new block
      const faucetAddress = await getFaucetAddress()
      const logs = await publicClient.getLogs({
        fromBlock: blockNumber,
        toBlock: blockNumber,
        address: faucetAddress as `0x${string}`,
      })

      // Process logs for each active monitor
      for (const [monitorId, state] of activeMonitors) {
        const [tokenType, messageId] = monitorId.split('-')
        await this.processLogsForMonitor(tokenType as 'active' | 'link', messageId, logs, state)
      }
    } catch (error) {
      console.error('Error processing new block for CCIP monitoring:', error)
    }
  }

  /**
   * Process logs for a specific monitor
   */
  private async processLogsForMonitor(
    tokenType: 'active' | 'link',
    messageId: string,
    logs: Log[],
    state: MonitoringState
  ): Promise<void> {
    // Check for CCIP-related events in logs
    const ccipEvents = logs.filter(log => 
      log.topics.some(topic => topic?.includes(messageId.slice(2))) // Remove 0x prefix
    )

    if (ccipEvents.length > 0) {
      console.log(`📨 Found ${ccipEvents.length} CCIP events for ${tokenType}`)
      // Trigger immediate phase check
      // This would be handled by the specific phase monitoring logic
    }
  }

  /**
   * Monitor specific CCIP phase with adaptive intervals
   */
  private async monitorPhase(config: CCIPMonitorConfig): Promise<void> {
    const monitorId = `${config.tokenType}-${config.messageId}`
    const state = this.monitors.get(monitorId)
    
    if (!state || !state.isActive) return

    const intervals = this.getPhaseIntervals(config.currentPhase)
    let attempts = 0

    const checkPhase = async () => {
      if (!state.isActive) return

      try {
        const result = await this.checkCurrentPhase(config)
        
        if (result.completed) {
          config.onComplete(result.data)
          this.stopMonitoring(config.tokenType, config.messageId)
          return
        }

        if (result.phaseChanged) {
          config.onPhaseUpdate(result.newPhase, result.progress, result.data)
          // Restart monitoring with new phase
          const newConfig = { ...config, currentPhase: result.newPhase }
          setTimeout(() => this.monitorPhase(newConfig), 1000)
          return
        }

        // Continue monitoring with adaptive interval
        attempts++
        const nextInterval = this.getAdaptiveInterval(config.currentPhase, attempts, state.failureCount)
        
        if (attempts < intervals.maxAttempts) {
          setTimeout(checkPhase, nextInterval)
        } else {
          config.onError(`Phase ${config.currentPhase} timed out after ${attempts} attempts`)
          this.stopMonitoring(config.tokenType, config.messageId)
        }

      } catch (error) {
        state.failureCount++
        console.error(`CCIP phase check error (attempt ${attempts}):`, error)
        
        if (state.failureCount > 3) {
          config.onError(`Too many failures in phase ${config.currentPhase}`)
          this.stopMonitoring(config.tokenType, config.messageId)
        } else {
          // Retry with exponential backoff
          const retryDelay = Math.min(30000, 5000 * Math.pow(2, state.failureCount))
          setTimeout(checkPhase, retryDelay)
        }
      }
    }

    // Start with initial delay
    setTimeout(checkPhase, intervals.initial)
  }

  /**
   * Get monitoring intervals for different phases
   */
  private getPhaseIntervals(phase: string): { initial: number; regular: number; maxAttempts: number } {
    switch (phase) {
      case 'wallet_confirm':
        return { initial: 2000, regular: 5000, maxAttempts: 12 } // 1 minute total
      
      case 'monad_confirm':
        return { initial: 3000, regular: 8000, maxAttempts: 15 } // 2 minutes total
      
      case 'ccip_pending':
        return { initial: 10000, regular: 30000, maxAttempts: 20 } // 10 minutes total
      
      case 'avalanche_confirm':
        return { initial: 15000, regular: 45000, maxAttempts: 15 } // 11 minutes total
      
      case 'ccip_response':
        return { initial: 20000, regular: 60000, maxAttempts: 10 } // 10 minutes total
      
      case 'monad_refill':
        return { initial: 5000, regular: 15000, maxAttempts: 8 } // 2 minutes total
      
      default:
        return { initial: 10000, regular: 30000, maxAttempts: 12 } // Default: 6 minutes
    }
  }

  /**
   * Get adaptive interval based on phase, attempts, and failure count
   */
  private getAdaptiveInterval(phase: string, attempts: number, failureCount: number): number {
    const baseInterval = this.getPhaseIntervals(phase).regular
    
    // Increase interval with attempts (but cap it)
    const attemptMultiplier = Math.min(2, 1 + (attempts * 0.1))
    
    // Increase interval with failures (exponential backoff)
    const failureMultiplier = Math.pow(1.5, failureCount)
    
    return Math.min(120000, baseInterval * attemptMultiplier * failureMultiplier) // Cap at 2 minutes
  }

  /**
   * Check current phase status
   */
  private async checkCurrentPhase(config: CCIPMonitorConfig): Promise<{
    completed: boolean
    phaseChanged: boolean
    newPhase?: string
    progress: number
    data?: any
  }> {
    // This would contain the actual phase checking logic
    // For now, return a placeholder that indicates ongoing monitoring
    
    switch (config.currentPhase) {
      case 'wallet_confirm':
        return this.checkWalletConfirmation(config)
      
      case 'monad_confirm':
        return this.checkMonadConfirmation(config)
      
      case 'ccip_pending':
        return this.checkCCIPPending(config)
      
      case 'avalanche_confirm':
        return this.checkAvalancheConfirmation(config)
      
      case 'ccip_response':
        return this.checkCCIPResponse(config)
      
      case 'monad_refill':
        return this.checkMonadRefill(config)
      
      default:
        return { completed: false, phaseChanged: false, progress: 0 }
    }
  }

  /**
   * Phase-specific checking methods
   */
  private async checkWalletConfirmation(config: CCIPMonitorConfig) {
    // Check if wallet transaction is confirmed
    // This would integrate with the existing transaction monitoring
    return { completed: false, phaseChanged: false, progress: 5 }
  }

  private async checkMonadConfirmation(config: CCIPMonitorConfig) {
    // Check if Monad transaction is confirmed
    return { completed: false, phaseChanged: false, progress: 15 }
  }

  private async checkCCIPPending(config: CCIPMonitorConfig) {
    // Check CCIP message status via API or events
    return { completed: false, phaseChanged: false, progress: 35 }
  }

  private async checkAvalancheConfirmation(config: CCIPMonitorConfig) {
    // Check if message reached Avalanche
    return { completed: false, phaseChanged: false, progress: 60 }
  }

  private async checkCCIPResponse(config: CCIPMonitorConfig) {
    // Check for response from Avalanche
    return { completed: false, phaseChanged: false, progress: 85 }
  }

  private async checkMonadRefill(config: CCIPMonitorConfig) {
    // Check if refill completed on Monad
    return { completed: true, phaseChanged: false, progress: 100, data: { success: true } }
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      activeMonitors: this.monitors.size,
      isListening: this.isListening,
      monitors: Array.from(this.monitors.entries()).map(([id, state]) => ({
        id,
        isActive: state.isActive,
        failureCount: state.failureCount,
        lastBlockChecked: state.lastBlockChecked.toString()
      }))
    }
  }
}

// Global smart monitor instance
export const smartCCIPMonitor = new SmartCCIPMonitor()

/**
 * Start smart CCIP monitoring with event-driven updates
 */
export async function startSmartCCIPMonitoring(
  tokenType: 'active' | 'link',
  messageId: string,
  currentPhase: string,
  callbacks: {
    onPhaseUpdate: (phase: string, progress: number, data?: any) => void
    onComplete: (result: any) => void
    onError: (error: string) => void
  }
): Promise<void> {
  return smartCCIPMonitor.startMonitoring({
    messageId,
    tokenType,
    currentPhase,
    ...callbacks
  })
}

/**
 * Stop smart CCIP monitoring
 */
export function stopSmartCCIPMonitoring(tokenType: 'active' | 'link', messageId: string): void {
  smartCCIPMonitor.stopMonitoring(tokenType, messageId)
}

/**
 * Get monitoring statistics
 */
export function getMonitoringStats() {
  return smartCCIPMonitor.getStats()
} 