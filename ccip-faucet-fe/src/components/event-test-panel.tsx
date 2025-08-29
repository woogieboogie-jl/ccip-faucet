import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotificationManager } from '@/components/notification-toast'
import { useFaucetStore } from '@/store/faucet-store'

interface EventTestPanelProps {
  isOwner: boolean
  isAdminPanelOpen: boolean
}

export function EventTestPanel({ isOwner, isAdminPanelOpen }: EventTestPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { showSuccess, showError, showInfo, showWarning } = useNotificationManager()
  const { updateTokenState, setCCIPRequestState, updateVolatility } = useFaucetStore()

  // Only show if user is owner and admin panel is open
  if (!isOwner || !isAdminPanelOpen) {
    return null
  }

  const testNotifications = () => {
    showSuccess('Test Success', 'This is a test success notification', 3000)
    setTimeout(() => showError('Test Error', 'This is a test error notification', 3000), 1000)
    setTimeout(() => showInfo('Test Info', 'This is a test info notification', 3000), 2000)
    setTimeout(() => showWarning('Test Warning', 'This is a test warning notification', 3000), 3000)
  }

  const testDripEvent = () => {
    // Simulate a drip event by updating token state
    updateTokenState('active', {
      isDripLoading: false,
    })
    showSuccess('Drip Event Simulated', 'MON token drip completed successfully', 4000)
  }

  const testVolatilityEvent = () => {
    // Simulate a volatility event
    const volatilityScore = Math.floor(Math.random() * 1000)
    const multiplier = 0.5 + (volatilityScore / 1000) * 1.5
    
    updateVolatility({
      score: volatilityScore,
      multiplier: multiplier,
      lastUpdated: new Date(),
      isUpdating: false
    })
    
    setCCIPRequestState({
      status: "success",
      progress: 100,
      responseMessageId: `0x${Math.random().toString(16).substr(2, 8)}test`,
    })
    
    showSuccess('Volatility Event Simulated', `New score: ${volatilityScore} (${Math.round(multiplier * 100)}% multiplier)`, 5000)
  }

  const testReservoirEvent = () => {
    // Simulate a reservoir refill event
    const newDripRate = Math.floor(Math.random() * 100) + 10
    const newPool = Math.floor(Math.random() * 1000) + 100
    
    updateTokenState('active', {
      tankBalance: newPool,
      currentDripAmount: newDripRate,
    })
    
    showSuccess('Reservoir Event Simulated', `MON tank updated - New drip rate: ${newDripRate}, Pool: ${newPool}`, 4000)
  }

  const testRefillTriggeredEvent = () => {
    // Simulate a refill triggered event
    const messageId = `0x${Math.random().toString(16).substr(2, 8)}trigger`
    
    setCCIPRequestState({
      status: "running",
      progress: 10,
      outboundMessageId: messageId,
      currentPhase: "request_confirmed",
    })
    
    showInfo('Refill Triggered Event Simulated', 'CCIP request sent to refill tank...', 3000)
  }

  const testCCIPFlow = () => {
    // Simulate a complete CCIP flow
    const messageId = `0x${Math.random().toString(16).substr(2, 8)}ccip`
    
    // Step 1: Initiate CCIP
    setCCIPRequestState({
      status: "running",
      progress: 10,
      outboundMessageId: messageId,
      currentPhase: "request_confirmed",
    })
    showInfo('CCIP Flow Started', 'Cross-chain request initiated...', 2000)
    
    // Step 2: CCIP confirmed
    setTimeout(() => {
      setCCIPRequestState({
        status: "running",
        progress: 50,
        outboundMessageId: messageId,
        currentPhase: "outbound_received",
      })
      
      showInfo('CCIP Confirmed', 'Cross-chain message confirmed...', 2000)
      
      // Step 3: Complete
      setTimeout(() => {
        const volatilityScore = Math.floor(Math.random() * 1000)
        
        setCCIPRequestState({
          status: "success",
          progress: 100,
          outboundMessageId: messageId,
          responseMessageId: `0x${Math.random().toString(16).substr(2, 8)}response`,
        })
        
        showSuccess('CCIP Flow Complete', `Volatility data received: ${volatilityScore} score`, 3000)
      }, 4000)
    }, 4000)
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 left-4 z-[9998]">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          Test Events
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9998]">
      <Card className="w-80 bg-white/10 border-white/20 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm">Event Test Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={testNotifications}
              size="sm"
              className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-400/30"
            >
              Test Notifications
            </Button>
            <Button
              onClick={testDripEvent}
              size="sm"
              className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-400/30"
            >
              Test Drip Event
            </Button>
            <Button
              onClick={testVolatilityEvent}
              size="sm"
              className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-400/30"
            >
              Test Volatility Event
            </Button>
            <Button
              onClick={testReservoirEvent}
              size="sm"
              className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-400/30"
            >
              Test Reservoir Event
            </Button>
            <Button
              onClick={testRefillTriggeredEvent}
              size="sm"
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-400/30"
            >
              Test Refill Event
            </Button>
            <Button
              onClick={testCCIPFlow}
              size="sm"
              className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border-indigo-400/30"
            >
              Test CCIP Flow
            </Button>
            <Button
              onClick={() => setIsVisible(false)}
              size="sm"
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}