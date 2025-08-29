import React from 'react'
import { useCCIPRequest } from '@/store/faucet-store'
import { getCCIPExplorerUrl } from '@/lib/config/ui/constants'
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'

// Phase descriptions and progress values
const PHASE_CONFIG = {
  request_clicked: { progress: 0, description: 'Waiting for wallet confirmation...' },
  request_confirmed: { progress: 5, description: 'Transaction confirmed on Active Chain' },
  outbound_sent: { progress: 10, description: 'CCIP message sent to Helper Chain' },
  outbound_received: { progress: 45, description: 'Helper Chain processing volatility data' },
  inbound_sent: { progress: 70, description: 'Response message sent back to Active Chain' },
  inbound_received: { progress: 100, description: 'Refill completed successfully' },
} as const

// Status icons and colors
const STATUS_CONFIG = {
  idle: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  running: { icon: Loader2, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  success: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  failed: { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20' },
} as const

export const CCIPProgress: React.FC = () => {
  const ccipRequest = useCCIPRequest()

  // Don't render if no active request
  if (ccipRequest.status === 'idle') {
    return null
  }

  const currentPhase = ccipRequest.currentPhase
  const phaseConfig = currentPhase ? PHASE_CONFIG[currentPhase] : null
  const statusConfig = STATUS_CONFIG[ccipRequest.status]

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Main Progress Card */}
      <div className={`rounded-lg border p-4 ${statusConfig.bgColor} border-current/30 transition-all duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <statusConfig.icon className={`h-5 w-5 ${statusConfig.color}`} />
            <h3 className="font-semibold text-white">
              {ccipRequest.status === 'running' ? 'CCIP Refill in Progress' : 
               ccipRequest.status === 'success' ? 'Refill Completed' : 
               ccipRequest.status === 'failed' ? 'Refill Failed' : 'CCIP Status'}
            </h3>
          </div>
          <span className="text-sm text-white font-semibold">
            {ccipRequest.progress}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/10 rounded-full h-2 mb-4 hover:bg-white/15 transition-colors duration-200">
          <div 
            className="bg-white/70 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${ccipRequest.progress}%` }}
          />
        </div>

        {/* Phase Description */}
        {phaseConfig && (
          <p className="text-sm text-white/80 mb-3">
            {phaseConfig.description}
          </p>
        )}

        {/* Transaction Details */}
        {ccipRequest.initialTxHash && (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-white/60">Initial TX:</span>
              <span className="text-white/80 font-mono">
                {ccipRequest.initialTxHash.slice(0, 8)}...{ccipRequest.initialTxHash.slice(-6)}
              </span>
            </div>
            
            {ccipRequest.outboundMessageId && (
              <div className="flex justify-between">
                <span className="text-white/60">Outbound Message:</span>
                <span className="text-white/80 font-mono">
                  {ccipRequest.outboundMessageId.slice(0, 8)}...{ccipRequest.outboundMessageId.slice(-6)}
                </span>
              </div>
            )}
            
            {ccipRequest.responseMessageId && (
              <div className="flex justify-between">
                <span className="text-white/60">Response Message:</span>
                <span className="text-white/80 font-mono">
                  {ccipRequest.responseMessageId.slice(0, 8)}...{ccipRequest.responseMessageId.slice(-6)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {ccipRequest.errorMessage && (
          <div className="mt-3 p-2 bg-red-500/20 border border-red-400/30 rounded text-xs text-red-200">
            {ccipRequest.errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        {ccipRequest.status === 'failed' && (
          <div className="mt-4 flex space-x-2">
            <button
              onClick={() => window.open(getCCIPExplorerUrl(ccipRequest.outboundMessageId!), '_blank')}
              className="flex-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded text-xs text-blue-200 transition-colors"
            >
              View on CCIP Explorer
            </button>
            <button
              onClick={() => window.open(`https://testnet.monadexplorer.com/tx/${ccipRequest.initialTxHash}`, '_blank')}
              className="flex-1 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded text-xs text-purple-200 transition-colors"
            >
              View Transaction
            </button>
          </div>
        )}
      </div>

      {/* Phase Indicators */}
      <div className="mt-4 grid grid-cols-6 gap-1">
        {Object.entries(PHASE_CONFIG).map(([phase, config]) => {
          const isCompleted = ccipRequest.progress >= config.progress
          const isCurrent = ccipRequest.currentPhase === phase
          
          return (
            <div
              key={phase}
              className={`h-1 rounded-full transition-all duration-300 ${
                isCompleted 
                  ? 'bg-green-500' 
                  : isCurrent 
                    ? 'bg-blue-500' 
                    : 'bg-white/20'
              }`}
              title={config.description}
            />
          )
        })}
      </div>
    </div>
  )
} 