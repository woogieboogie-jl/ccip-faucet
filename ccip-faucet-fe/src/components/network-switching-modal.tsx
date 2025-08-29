import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { Network, AlertTriangle, Loader2, X } from 'lucide-react'

interface Chain {
  id: number
  name: string
  icon: string
}

interface NetworkSwitchingModalProps {
  isOpen: boolean
  onClose: () => void
  availableChains: Chain[]
  currentChainId?: number
  onChainSelect: (chainId: number) => void
  isSwitching: boolean
  switchError: string | null
}

export function NetworkSwitchingModal({
  isOpen,
  onClose,
  availableChains,
  currentChainId,
  onChainSelect,
  isSwitching,
  switchError,
}: NetworkSwitchingModalProps) {
  const [selectedChain, setSelectedChain] = useState<number | null>(null)

  // Reset selection when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedChain(null)
    }
  }, [isOpen])

  const handleChainSelect = (chainId: number) => {
    setSelectedChain(chainId)
    onChainSelect(chainId)
  }

  const getChainIcon = (chain: Chain) => {
    // Try to load the icon, fallback to network icon
    return (
      <div className="relative">
        <img
          src={chain.icon}
          alt={`${chain.name} icon`}
          className="w-6 h-6 rounded-full"
          onError={(e) => {
            // Fallback to network icon if image fails
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.parentElement?.querySelector('.fallback-icon')
            if (fallback) {
              (fallback as HTMLElement).style.display = 'flex'
            }
          }}
        />
        <div className="fallback-icon hidden absolute inset-0 items-center justify-center">
          <Network className="w-4 h-4 text-white" />
        </div>
      </div>
    )
  }

  const isCurrentChain = (chainId: number) => currentChainId === chainId

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="font-body text-xl font-bold text-white flex items-center gap-2">
            <Network className="w-5 h-5" />
            Switch Network
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Network Display */}
          {currentChainId && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <p className="font-body text-sm text-white/60 mb-2">Current Network</p>
              <div className="flex items-center gap-3">
                {getChainIcon(availableChains.find(c => c.id === currentChainId) || availableChains[0])}
                <span className="font-body text-white font-medium">
                  {availableChains.find(c => c.id === currentChainId)?.name || 'Unknown Network'}
                </span>
              </div>
            </div>
          )}

          {/* Available Networks */}
          <div className="space-y-2">
            <p className="font-body text-sm text-white/60">Available Networks</p>
            <div className="grid gap-2">
              {availableChains.map((chain) => (
                <ActionButton
                  key={chain.id}
                  variant={isCurrentChain(chain.id) ? "green" : "primary"}
                  state={isSwitching ? "loading" : isCurrentChain(chain.id) ? "disabled" : "enabled"}
                  onClick={() => handleChainSelect(chain.id)}
                  fullWidth={true}
                  size="lg"
                  icon={getChainIcon(chain)}
                  rightIcon={
                    isCurrentChain(chain.id) ? (
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    ) : isSwitching && selectedChain === chain.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null
                  }
                  tooltip={
                    isCurrentChain(chain.id) 
                      ? `Currently connected to ${chain.name}` 
                      : `Switch to ${chain.name}`
                  }
                  className="h-12 justify-start"
                >
                  <span className="font-body">{chain.name}</span>
                </ActionButton>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {switchError && (
            <div className="bg-red-500/10 border border-red-400/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="font-body text-red-400 text-sm">{switchError}</span>
              </div>
            </div>
          )}

          {/* Info Text */}
          <div className="font-body text-xs text-white/40 text-center pt-2">
            {isSwitching 
              ? 'Confirm the network switch in your wallet...'
              : 'Select a network to switch to. You will be prompted to confirm in your wallet.'
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 