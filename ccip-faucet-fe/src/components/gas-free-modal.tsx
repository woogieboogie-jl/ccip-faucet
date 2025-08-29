
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Info, CheckCircle, AlertCircle } from "lucide-react"
import { useAccountAbstraction } from "@/hooks/use-account-abstraction"
import { getFaucetAddress } from '@/lib/config'
// CONSOLIDATION: Use configurable explorer URL instead of hardcoded
import { getConfigExplorerUrl } from '@/lib/config/ui/constants'
import type { DerivedConfig } from '@/lib/types/config'

interface GasFreeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  walletAddress: string | null
  dripAmount: number
  derivedConfig?: DerivedConfig
}

export function GasFreeModal({ isOpen, onClose, onSuccess, walletAddress, dripAmount, derivedConfig }: GasFreeModalProps) {
  const [step, setStep] = useState<"intro" | "signing" | "processing" | "success" | "error">("intro")
  const [error, setError] = useState<string>("")
  const [txHash, setTxHash] = useState<string>("")
  const [faucetContractAddress, setFaucetContractAddress] = useState<string>("")
  // CONSOLIDATION: Dynamic explorer URL based on active chain
  const [explorerTxUrl, setExplorerTxUrl] = useState<string>("")

  const { executeGaslessTransaction, isProcessing } = useAccountAbstraction()

  // CONSOLIDATION: Load faucet address and explorer URL from config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Load faucet address from consolidated config
        const address = await getFaucetAddress()
        setFaucetContractAddress(address)
        
        // CONSOLIDATION: Load explorer URL for current chain
        if (txHash) {
          const explorerUrl = await getConfigExplorerUrl('active', 'tx', txHash)
          setExplorerTxUrl(explorerUrl)
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    }
    
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen, txHash])

  const handleExecuteTransaction = async () => {
    if (!walletAddress) return

    try {
      setStep("signing")

      // Execute the gasless transaction using UserOperations
      // IMPORTANT: First parameter is the recipient (EOA address), second is faucet address
      console.log('Gas-Free Modal - Executing AA transaction:')
      console.log('- Recipient (EOA):', walletAddress)
      console.log('- Faucet Address:', faucetContractAddress)
      
      const result = await executeGaslessTransaction(
        walletAddress as `0x${string}`,        // recipient = EOA address (where tokens go)
        faucetContractAddress as `0x${string}`, // faucet = contract address
      )

      if (result.success) {
        setTxHash(result.txHash || "")
        setStep("success")
        
        // 🆕 FIX: Automatically call success handler when transaction succeeds
        // This ensures tank balance updates and timer is set immediately
        console.log('🎉 AA transaction successful - calling success handler')
        onSuccess()
      } else {
        setError(result.error || "Transaction failed")
        setStep("error")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setStep("error")
    }
  }

  const handleClose = () => {
    if (step !== "signing" && step !== "processing") {
      onClose()
      setStep("intro")
      setError("")
      setTxHash("")
    }
  }

  const renderContent = () => {
    switch (step) {
      case "intro":
        return (
          <>
            <div className="flex items-start space-x-3 bg-white/10 p-4 rounded-lg">
              <Info className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
              <div className="text-white text-sm">
                <p className="font-body text-sm">Sign the message to receive your first {derivedConfig?.nativeSymbol || 'MON'} tokens.</p>
                <p className="text-white/80">
                  Gas fees will be sponsored for you.
                </p>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="text-white">
                <p className="font-body text-lg font-semibold">You'll receive:</p>
                <p className="font-body text-2xl font-bold">{dripAmount} {derivedConfig?.nativeSymbol || 'MON'}</p>
                <p className="text-sm text-white/70">(Gas Fees on Us)</p>
              </div>

              <Button
                onClick={handleExecuteTransaction}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/30 text-white hover:bg-white/20 text-lg py-3"
              >
                Confirm Request
              </Button>
            </div>
          </>
        )

      case "signing":
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-white">
              <p className="font-body text-lg font-semibold mb-2">Creating UserOperation...</p>
              <p className="text-white/80 text-sm">Please sign the message in your wallet</p>
            </div>
          </div>
        )

      case "processing":
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-white">
              <p className="font-body text-lg font-semibold mb-2">Processing UserOperation...</p>
              <p className="text-white/80 text-sm">Bundler is including your transaction</p>
            </div>
          </div>
        )

      case "success":
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
            <div className="text-white">
              <p className="font-body text-lg font-semibold mb-2">Success!</p>
              <p className="text-white/80 mb-4">Your first {derivedConfig?.nativeSymbol || 'MON'} tokens have arrived – gas fees were sponsored for you.</p>
              {txHash && explorerTxUrl && (
                <div className="bg-white/10 p-3 rounded-lg">
                  <p className="text-xs text-white/70 mb-1">Transaction Hash:</p>
                  <a
                    href={explorerTxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-300 underline break-all hover:text-blue-200"
                  >
                    {txHash}
                  </a>
                </div>
              )}
            <Button
              onClick={() => {
                // onSuccess() already called automatically when transaction succeeded
                handleClose()
              }}
              className="mt-6 bg-white/10 backdrop-blur-sm border border-white/30 text-white hover:bg-white/20 w-full"
            >
              Close
            </Button>
            </div>
          </div>
        )

      case "error":
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto" />
            <div className="text-white">
              <p className="font-body text-lg font-semibold mb-2">Transaction Failed</p>
              <p className="text-white/80 text-sm mb-4">{error}</p>
              <Button
                onClick={() => setStep("intro")}
                className="bg-white text-monad-purple hover:bg-white/90"
              >
                Try Again
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent variant="glass" className="max-w-md border-0 focus:outline-none focus-visible:ring-0">
        <DialogHeader>
          <DialogTitle className="text-white font-body text-xl font-bold text-center">
            {step === "success" ? "Welcome to Monad!" : "Gas-Free Onboarding"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  )
}
