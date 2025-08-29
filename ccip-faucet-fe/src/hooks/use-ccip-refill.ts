import { useEffect, useRef } from 'react'
import { useWalletClient, usePublicClient } from 'wagmi'
import { keccak256, toBytes, decodeEventLog, type Log } from 'viem'
import { useFaucetStore, useCCIPRequest } from '@/store/faucet-store'
import { PublicClientService } from '@/lib/public-client'
import { getActiveChainConfig, getHelperChainConfig } from '@/lib/config'
import { getCCIPExplorerUrl } from '@/lib/config/ui/constants'
import { faucetAbi } from '@/lib/faucetAbi'
import type { CCIPRequest, CCIPRequestPhase } from '@/lib/types'
import { formatEther } from 'viem'
import { getFaucetSnapshot } from '@/lib/faucetClient'

// Global notification functions (will be set by the notification system)
let showSuccessNotification: ((title: string, message: string, duration?: number) => void) | null = null
let showErrorNotification: ((title: string, message: string, duration?: number) => void) | null = null
let showInfoNotification: ((title: string, message: string, duration?: number) => void) | null = null
let showWarningNotification: ((title: string, message: string, duration?: number) => void) | null = null

// Function to set notification functions (called by the notification system)
export const setCCIPNotificationFunctions = (
  success: (title: string, message: string, duration?: number) => void,
  error: (title: string, message: string, duration?: number) => void,
  info: (title: string, message: string, duration?: number) => void,
  warning: (title: string, message: string, duration?: number) => void
) => {
  showSuccessNotification = success
  showErrorNotification = error
  showInfoNotification = info
  showWarningNotification = warning
}

// Event signatures for contract events
const EVENT_SIGNATURES = {
  RefillTriggered: keccak256(toBytes("RefillTriggered(bytes32)")),
  VolatilityResponseSent: keccak256(toBytes("VolatilityResponseSent(bytes32,bytes32,uint256,address)")),
  ReservoirRefilled: keccak256(toBytes("ReservoirRefilled(address,uint256,uint256)")),
}

// CCIP Explorer URL generation (consolidated)
const POLLING_INTERVAL_MS = 15000 // 15 seconds as specified in PRD

// CCIP message status codes (kept for reference, no longer used for API calls)
const CCIP_STATUS = {
  PENDING: 1,
  SENT: 2,
  DELIVERED: 3,
  FAIL: 4,
  OUT_OF_GAS: 5,
} as const

export function useCCIPRefillNew() {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  
  // FIX: Use proper Zustand selectors instead of destructuring entire store
  const ccipRequest = useFaucetStore(state => state.ccipRequest)
  const setCCIPRequestState = useFaucetStore(state => state.setCCIPRequestState)
  const resetCCIPRequest = useFaucetStore(state => state.resetCCIPRequest)
  
  // DIAGNOSTIC: Log when hook re-renders to confirm subscription is working
  console.log('🔄 DIAGNOSTIC: useCCIPRefillNew hook rendered with state:', {
    currentPhase: ccipRequest.currentPhase,
    progress: ccipRequest.progress,
    outboundMessageId: ccipRequest.outboundMessageId,
    status: ccipRequest.status,
    timestamp: new Date().toISOString()
  })
  
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMonitoringRef = useRef(false)

  // Cleanup monitoring on unmount
  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current)
        monitoringIntervalRef.current = null
      }
      isMonitoringRef.current = false
    }
  }, [])

  // REBUILD: Restart monitoring on page refresh if there's an active request
  useEffect(() => {
    // Check if there's an active CCIP request that needs monitoring
    if (ccipRequest.status === "running" && ccipRequest.initialTxHash && !isMonitoringRef.current) {
      console.log('🔄 Rebuilding CCIP monitoring for existing request:', ccipRequest.initialTxHash)
      startMonitoring(ccipRequest.initialTxHash)
    }
  }, [ccipRequest.status, ccipRequest.initialTxHash])

  // NEW: False positive detection on component mount
  useEffect(() => {
    const checkForFalsePositive = async () => {
      // Only check if we have a running state but no monitoring
      if (ccipRequest.status === "running" && !isMonitoringRef.current) {
        console.log('🔍 Checking for false positive on component mount...')
        const contractRefillInProgress = await checkContractRefillState()
        if (!contractRefillInProgress) {
          console.log('🔄 Detected false positive on mount: refillInProgress is false, resetting state')
          resetCCIPRequest()
        } else {
          // If contract says it's in progress but we're not monitoring, restart monitoring
          if (ccipRequest.initialTxHash) {
            console.log('🔄 Restarting monitoring for existing request:', ccipRequest.initialTxHash)
            startMonitoring(ccipRequest.initialTxHash)
          }
        }
      }
    }

    checkForFalsePositive()
  }, []) // Run only on mount

  // Generate CCIP Explorer URLs for user tracking
  const generateExplorerUrls = (outboundMessageId?: string, responseMessageId?: string) => {
    const urls: { outbound?: string; inbound?: string } = {}
    
    if (outboundMessageId) {
      urls.outbound = getCCIPExplorerUrl(outboundMessageId)
      console.log(`🔗 Generated outbound Explorer URL: ${urls.outbound}`)
    }
    
    if (responseMessageId) {
      urls.inbound = getCCIPExplorerUrl(responseMessageId)
      console.log(`🔗 Generated inbound Explorer URL: ${urls.inbound}`)
    }
    
    return urls
  }

  // Check for RefillTriggered event on Active Chain
  const checkActiveChainForRefillTriggerEvent = async (txHash: string): Promise<{ success: boolean; messageId?: string }> => {
    try {
      const activeConfig = await getActiveChainConfig()
      const client = await PublicClientService.getInstance().getClient()
      
      console.log(`🔍 DIAGNOSTIC: Checking RefillTriggered event for tx: ${txHash} at ${new Date().toISOString()}`)
      
      const receiptStartTime = Date.now()
      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
      const receiptEndTime = Date.now()
      
      console.log(`📋 DIAGNOSTIC: Transaction receipt (fetched in ${receiptEndTime - receiptStartTime}ms):`, {
        status: receipt?.status,
        logsCount: receipt?.logs.length,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed,
        transactionIndex: receipt?.transactionIndex,
      })
      
      if (receipt?.status !== 'success') {
        console.log(`❌ Transaction receipt status: ${receipt?.status}`)
        
        // If transaction reverted, check why
        if (receipt?.status === 'reverted') {
          console.log(`🔍 Transaction reverted - checking contract state...`)
          
          // Check if reservoirs are sufficiently full
          const snap = await getFaucetSnapshot()
          const activeThreshold = Number(formatEther(snap.active.drip)) * snap.constants.thresholdFactor
          const linkThreshold = Number(formatEther(snap.link.drip)) * snap.constants.thresholdFactor
          
          console.log(`🔍 Reservoir thresholds:`, {
            activePool: Number(formatEther(snap.active.pool)),
            activeThreshold,
            activeNeedsRefill: Number(formatEther(snap.active.pool)) < activeThreshold,
            linkPool: Number(formatEther(snap.link.pool)),
            linkThreshold,
            linkNeedsRefill: Number(formatEther(snap.link.pool)) < linkThreshold,
          })
          
          // Check if refill is already in progress
          const refillInProgress = await client.readContract({
            address: activeConfig.contracts.faucet as `0x${string}`,
            abi: faucetAbi,
            functionName: 'refillInProgress',
          }) as boolean
          
          console.log(`🔍 Refill in progress: ${refillInProgress}`)
        }
        
        return { success: false }
      }

      console.log(`📋 DIAGNOSTIC: Transaction receipt has ${receipt.logs.length} logs`)
      console.log(`🔍 DIAGNOSTIC: Looking for RefillTriggered event signature: ${EVENT_SIGNATURES.RefillTriggered}`)

      // Look for RefillTriggered event
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i]
        console.log(`📝 DIAGNOSTIC: Log ${i}: topic[0]=${log.topics[0]}, address=${log.address}`)
        if (log.topics[0] === EVENT_SIGNATURES.RefillTriggered) {
          const messageId = log.topics[1]
          console.log(`✅ DIAGNOSTIC: SUCCESS! Found RefillTriggered event at log index ${i} with messageId: ${messageId}`)
          return { success: true, messageId }
        }
      }
      
      console.log(`❌ DIAGNOSTIC: RefillTriggered event NOT FOUND in any of the ${receipt.logs.length} transaction logs`)
      console.log(`📝 DIAGNOSTIC: All log topics for comparison:`)
      receipt.logs.forEach((log, i) => {
        console.log(`   Log ${i}: ${log.topics[0]} (from ${log.address})`)
      })
      console.log(`📝 DIAGNOSTIC: Expected RefillTriggered signature: ${EVENT_SIGNATURES.RefillTriggered}`)
      return { success: false }
    } catch (error) {
      console.error('❌ Error checking RefillTriggered event:', error)
      return { success: false }
    }
  }

  // Check contract refillInProgress state to detect false positives
  const checkContractRefillState = async (): Promise<boolean> => {
    try {
      const activeConfig = await getActiveChainConfig()
      const client = await PublicClientService.getInstance().getClient()
      
      const refillInProgress = await client.readContract({
        address: activeConfig.contracts.faucet as `0x${string}`,
        abi: faucetAbi,
        functionName: 'refillInProgress',
      }) as boolean

      console.log(`🔍 Contract refillInProgress state: ${refillInProgress}`)
      return refillInProgress
    } catch (error) {
      console.error('❌ Error checking contract refillInProgress state:', error)
      return false // Default to false to allow progress
    }
  }

  // Check for ReservoirRefilled event on Active Chain (Phase 6)
  const checkForReservoirRefilledEvent = async (): Promise<boolean> => {
    try {
      console.log(`🔍 DIAGNOSTIC: Checking for ReservoirRefilled event on active chain`)
      
      const activeConfig = await getActiveChainConfig()
      const client = await PublicClientService.getInstance().getClient()
      
      const currentBlock = await client.getBlockNumber()
      const fromBlock = currentBlock - 50n // Look back 50 blocks for refill event
      console.log(`🔍 DIAGNOSTIC: Searching blocks ${fromBlock} to ${currentBlock} for ReservoirRefilled`)
      
      const logs = await client.getLogs({
        address: activeConfig.contracts.faucet as `0x${string}`,
        fromBlock,
        toBlock: 'latest',
      })

      console.log(`🔍 DIAGNOSTIC: Found ${logs.length} total logs on faucet contract`)
      console.log(`🔍 DIAGNOSTIC: Looking for ReservoirRefilled signature: ${EVENT_SIGNATURES.ReservoirRefilled}`)

      // Look for ReservoirRefilled event
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i]
        console.log(`🔍 DIAGNOSTIC: Faucet log ${i}: topic[0]=${log.topics[0]}, blockNumber=${log.blockNumber}`)
        
        if (log.topics[0] === EVENT_SIGNATURES.ReservoirRefilled) {
          console.log(`✅ DIAGNOSTIC: Found ReservoirRefilled event at log ${i}`)
          return true
        }
      }
      
      console.log(`❌ DIAGNOSTIC: No ReservoirRefilled events found in ${logs.length} logs`)
      return false
    } catch (error) {
      console.error('❌ DIAGNOSTIC: Error checking ReservoirRefilled event:', error)
      return false
    }
  }

  // Check for VolatilityResponseSent event on Helper Chain
  const checkHelperChainForResponseEvent = async (outboundMessageId: string): Promise<{ success: boolean; responseMessageId?: string }> => {
    try {
      console.log(`🔍 DIAGNOSTIC: Searching for VolatilityResponseSent event on helper chain for outbound message: ${outboundMessageId}`)
      
      const helperConfig = await getHelperChainConfig()
      const client = await PublicClientService.getInstance().getHelperClient()
      
      console.log(`🔍 DIAGNOSTIC: Helper contract address: ${helperConfig.contracts.helper}`)
      
      const currentBlock = await client.getBlockNumber()
      const fromBlock = currentBlock - 100n // Look back 100 blocks
      console.log(`🔍 DIAGNOSTIC: Searching blocks ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock} blocks)`)
      
      const logs = await client.getLogs({
        address: helperConfig.contracts.helper as `0x${string}`,
        fromBlock,
        toBlock: 'latest',
      })

      console.log(`🔍 DIAGNOSTIC: Found ${logs.length} total logs on helper contract`)
      console.log(`🔍 DIAGNOSTIC: Looking for VolatilityResponseSent signature: ${EVENT_SIGNATURES.VolatilityResponseSent}`)

      // Look for VolatilityResponseSent event
      let volatilityEventCount = 0
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i]
        console.log(`🔍 DIAGNOSTIC: Helper log ${i}: topic[0]=${log.topics[0]}, blockNumber=${log.blockNumber}`)
        
        if (log.topics[0] === EVENT_SIGNATURES.VolatilityResponseSent) {
          volatilityEventCount++
          const responseMessageId = log.topics[1]
          console.log(`✅ DIAGNOSTIC: Found VolatilityResponseSent event #${volatilityEventCount} at log ${i} with responseMessageId: ${responseMessageId}`)
          return { success: true, responseMessageId }
        }
      }
      
      console.log(`❌ DIAGNOSTIC: No VolatilityResponseSent events found in ${logs.length} logs (found ${volatilityEventCount} total volatility events)`)
      return { success: false }
    } catch (error) {
      console.error('❌ DIAGNOSTIC: Error checking VolatilityResponseSent event:', error)
      return { success: false }
    }
  }

  // Main monitoring function with skip-ahead logic
  const startMonitoring = async (initialTxHash: string) => {
    if (isMonitoringRef.current) {
      console.warn('⚠️ Monitoring already active, ignoring new request')
      return
    }

    isMonitoringRef.current = true
    console.log('🔔 DIAGNOSTIC: Starting CCIP monitoring for transaction:', initialTxHash, 'at', new Date().toISOString())
    console.log(`🔔 DIAGNOSTIC: Monitoring will check every ${POLLING_INTERVAL_MS}ms (${POLLING_INTERVAL_MS/1000} seconds)`)

    monitoringIntervalRef.current = setInterval(async () => {
      const currentState = ccipRequest
      const tickTime = Date.now()
      
      console.log(`🔄 CCIP Monitoring tick at ${new Date(tickTime).toISOString()} - Current state:`, {
        status: currentState.status,
        currentPhase: currentState.currentPhase,
        progress: currentState.progress,
        initialTxHash: currentState.initialTxHash,
        outboundMessageId: currentState.outboundMessageId,
        responseMessageId: currentState.responseMessageId,
      })
      
      // 🔍 DIAGNOSTIC: Compare hook state vs direct Zustand state
      const { ccipRequest: directZustandState } = useFaucetStore.getState()
      console.log('🔍 DIAGNOSTIC: Direct Zustand state at tick start:', {
        currentPhase: directZustandState.currentPhase,
        progress: directZustandState.progress,
        outboundMessageId: directZustandState.outboundMessageId,
        status: directZustandState.status
      })
      
      if (currentState.outboundMessageId !== directZustandState.outboundMessageId) {
        console.log('🚨 DIAGNOSTIC: STATE MISMATCH! Hook state vs Zustand state differ!')
        console.log('   Hook outboundMessageId:', currentState.outboundMessageId)
        console.log('   Zustand outboundMessageId:', directZustandState.outboundMessageId)
      } else if (currentState.currentPhase === directZustandState.currentPhase) {
        console.log('✅ DIAGNOSTIC: STATE SYNC OK - Hook and Zustand states match!')
      }
      
      // CRITICAL: Check for false positive - if refillInProgress is false, reset state
      if (currentState.status === "running" && currentState.initialTxHash) {
        const contractRefillInProgress = await checkContractRefillState()
        if (!contractRefillInProgress) {
          console.log('🔄 Detected false positive: refillInProgress is false, resetting state')
          clearInterval(monitoringIntervalRef.current!)
          monitoringIntervalRef.current = null
          isMonitoringRef.current = false
          resetCCIPRequest()
          return
        }
      }
      
      // Check for terminal state first (Phase 6: Final completion via ReservoirRefilled event)
      if (currentState.currentPhase === 'inbound_sent') {
        console.log(`🔍 DIAGNOSTIC: Phase 6 - Checking for ReservoirRefilled event (final completion)`)
        const refilledEventFound = await checkForReservoirRefilledEvent()
        
        if (refilledEventFound) {
          console.log(`✅ DIAGNOSTIC: Phase 6 SUCCESS - Found ReservoirRefilled event - Process completed!`)
          clearInterval(monitoringIntervalRef.current!)
          monitoringIntervalRef.current = null
          isMonitoringRef.current = false
          
          setCCIPRequestState({
            currentPhase: 'inbound_received',
            progress: 100,
            status: 'success'
          })
          console.log('✅ CCIP process completed successfully - UI should show 100%')
          return
        } else {
          console.log(`🔍 DIAGNOSTIC: Phase 6 - ReservoirRefilled event not found yet, continuing to monitor`)
        }
      }

      // Skip-ahead phase checking (from earliest to latest)
      
      // Check for Phase 2: Initial transaction confirmed (FIRST)
      if (currentState.currentPhase !== 'request_confirmed' && currentState.initialTxHash) {
        const phase2StartTime = Date.now()
        console.log(`🔍 DIAGNOSTIC: Starting Phase 2 check at ${new Date(phase2StartTime).toISOString()} for tx: ${currentState.initialTxHash}`)
        const { success, messageId } = await checkActiveChainForRefillTriggerEvent(currentState.initialTxHash)
        const phase2EndTime = Date.now()
        console.log(`🔍 DIAGNOSTIC: Phase 2 check completed in ${phase2EndTime - phase2StartTime}ms`)
        
        if (success && messageId) {
          console.log(`✅ DIAGNOSTIC: Phase 2 SUCCESS - Found messageId ${messageId} - Advancing to 5%`)
          setCCIPRequestState({
            currentPhase: 'request_confirmed',
            progress: 5,
            outboundMessageId: messageId
          })
          console.log('📤 Initial transaction confirmed - UI should now show 5%')
          
          // 🔍 DIAGNOSTIC: Check if state update actually worked
          console.log('🔍 DIAGNOSTIC: State update called - checking current Zustand state:')
          const { ccipRequest: updatedState } = useFaucetStore.getState()
          console.log('🔍 DIAGNOSTIC: Zustand state after update:', {
            currentPhase: updatedState.currentPhase,
            progress: updatedState.progress,
            outboundMessageId: updatedState.outboundMessageId,
            status: updatedState.status
          })
        } else {
          console.log(`❌ DIAGNOSTIC: Phase 2 FAILED - success=${success}, messageId=${messageId} - Staying at 0%`)
        }
      }

      // Check for Phase 3: Generate outbound Explorer URL (assume success)
      if (currentState.currentPhase !== 'outbound_sent' && currentState.outboundMessageId) {
        console.log(`🔍 DIAGNOSTIC: Phase 3 - Generating Explorer URL for outbound message: ${currentState.outboundMessageId}`)
        
        const explorerUrls = generateExplorerUrls(currentState.outboundMessageId)
        
        console.log(`✅ DIAGNOSTIC: Phase 3 SUCCESS - Generated Explorer URL, advancing to 10%`)
        setCCIPRequestState({
          currentPhase: 'outbound_sent',
          progress: 10,
          explorerUrls: {
            ...currentState.explorerUrls,
            ...explorerUrls
          }
        })
        console.log('📤 Outbound message sent by CCIP - UI should now show 10% with Explorer link')
      }

      // Check for Phase 4: Outbound message received on Helper chain
      if (currentState.currentPhase !== 'outbound_received' && currentState.outboundMessageId) {
        const phase4StartTime = Date.now()
        console.log(`🔍 DIAGNOSTIC: Starting Phase 4 check at ${new Date(phase4StartTime).toISOString()} for outbound messageId: ${currentState.outboundMessageId}`)
        const { success, responseMessageId } = await checkHelperChainForResponseEvent(currentState.outboundMessageId)
        const phase4EndTime = Date.now()
        console.log(`🔍 DIAGNOSTIC: Phase 4 check completed in ${phase4EndTime - phase4StartTime}ms`)
        console.log(`🔍 DIAGNOSTIC: Helper chain event search result - success: ${success}, responseMessageId: ${responseMessageId}`)
        
        if (success && responseMessageId) {
          console.log(`✅ DIAGNOSTIC: Phase 4 SUCCESS - Found VolatilityResponseSent event with responseMessageId: ${responseMessageId} - Advancing to 45%`)
          setCCIPRequestState({
            currentPhase: 'outbound_received',
            progress: 45,
            responseMessageId
          })
          console.log('📥 Outbound message received on Helper chain - UI should now show 45%')
        } else {
          console.log(`❌ DIAGNOSTIC: Phase 4 FAILED - Helper chain event not found yet - Staying at 10%`)
        }
      }

      // Check for Phase 5: Generate inbound Explorer URL (assume success)
      if (currentState.currentPhase !== 'inbound_sent' && currentState.responseMessageId) {
        console.log(`🔍 DIAGNOSTIC: Phase 5 - Generating Explorer URL for response message: ${currentState.responseMessageId}`)
        
        const explorerUrls = generateExplorerUrls(undefined, currentState.responseMessageId)
        
        console.log(`✅ DIAGNOSTIC: Phase 5 SUCCESS - Generated inbound Explorer URL, advancing to 70%`)
        setCCIPRequestState({
          currentPhase: 'inbound_sent',
          progress: 70,
          explorerUrls: {
            ...currentState.explorerUrls,
            ...explorerUrls
          }
        })
        console.log('📤 Inbound message sent - UI should now show 70% with Explorer link')
      }

    }, POLLING_INTERVAL_MS)
  }

  // Initiate refill process
  const initiateRefillProcess = async () => {
    if (!walletClient || !publicClient) {
      console.error('❌ Wallet or public client not available')
      return
    }

    try {
      // Set initial state
      setCCIPRequestState({
        status: 'running',
        currentPhase: 'request_clicked',
        progress: 0,
        errorMessage: null
      })

      const activeConfig = await getActiveChainConfig()
      
      // Prepare transaction data for triggerRefillCheck
      const { request } = await publicClient.simulateContract({
        address: activeConfig.contracts.faucet as `0x${string}`,
        abi: faucetAbi,
        functionName: 'triggerRefillCheck',
        account: walletClient.account,
      })

      // Send transaction
      const hash = await walletClient.writeContract(request)
      const txSentTime = Date.now()
      console.log('📝 Transaction sent:', hash, 'at', new Date(txSentTime).toISOString())

      // Set the initial transaction hash in state
      setCCIPRequestState({
        initialTxHash: hash
      })

      // 🔍 DIAGNOSTIC: Check if transaction is immediately available
      console.log('🔍 DIAGNOSTIC: Checking transaction receipt immediately after wallet confirmation...')
      try {
        const immediateReceipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` })
        console.log('🔍 DIAGNOSTIC: Immediate receipt status:', immediateReceipt?.status, 'blockNumber:', immediateReceipt?.blockNumber)
      } catch (error: any) {
        console.log('🔍 DIAGNOSTIC: Immediate receipt not available yet:', error.message)
      }

      // Start monitoring after transaction is sent
      console.log('🔍 DIAGNOSTIC: Starting monitoring at', new Date().toISOString(), `(${Date.now() - txSentTime}ms after tx sent)`)
      startMonitoring(hash)

    } catch (error: any) {
      console.error('❌ Error initiating refill process:', error)
      
      if (error.message?.includes('User rejected')) {
        setCCIPRequestState({
          status: 'failed',
          errorMessage: 'Transaction was canceled by user.'
        })
      } else {
        setCCIPRequestState({
          status: 'failed',
          errorMessage: error.message || 'Failed to initiate refill process'
        })
      }
    }
  }

  // Reset CCIP request state
  const resetToIdle = () => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current)
      monitoringIntervalRef.current = null
    }
    isMonitoringRef.current = false
    resetCCIPRequest()
  }

  return {
    ccipRequest,
    initiateRefillProcess,
    resetToIdle,
    isMonitoring: isMonitoringRef.current
  }
}