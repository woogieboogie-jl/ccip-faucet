
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StatusCard, StatusAlert, ActionButton, ContractAddress } from "@/components/ui"
import { Shield, Minus, Info, AlertTriangle, RefreshCw } from "lucide-react"
import { useWalletClient } from 'wagmi'
import { parseAbi, encodeFunctionData, parseEther } from 'viem'
import { publicClient } from '@/lib/viem'
import { useFaucet } from "@/hooks/use-faucet"
import { useStatus } from "@/hooks/use-status"

// Dynamic vault thresholds: critical = next refill amount, warning = 10× refill amount
import { useAddressState, useAddressUtils } from '@/store/faucet-store'

import type { DerivedConfig } from '@/lib/types/config'

import React from "react"

interface VaultStatusProps {
  isOwner: boolean
  derivedConfig?: DerivedConfig | null
}

function VaultStatusComponent({ isOwner, derivedConfig }: VaultStatusProps) {
  const { faucet, refreshVaultBalances } = useFaucet()
  const { data: walletClient } = useWalletClient()  // Fixed: use useWalletClient from wagmi
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [withdrawToken, setWithdrawToken] = useState<"active" | "link">("active")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [isWithdrawValid, setIsWithdrawValid] = useState(true)
  
  // 🆕 CONSOLIDATED: Use Zustand address state instead of separate loading
  const addresses = useAddressState()
  const { loadAddresses } = useAddressUtils()

  // 🆕 CONSOLIDATED: Load addresses from Zustand on mount
  useEffect(() => {
    if (!addresses || !addresses.FAUCET_ADDRESS) {
      console.log('🏪 VaultStatus: Loading addresses into Zustand store...')
      loadAddresses()
    }
  }, [loadAddresses, addresses?.FAUCET_ADDRESS])

  // DEBUG: Log vault balances to understand the issue
  useEffect(() => {
    console.log('🏦 VaultStatus - Current faucet vault balances:', {
      vaultActive: faucet.vaultActive,  // Changed from vaultMon
      vaultLink: faucet.vaultLink,
      timestamp: new Date().toISOString()
    })
  }, [faucet.vaultActive, faucet.vaultLink])  // Changed from vaultMon

  // Determine dynamic thresholds based on on-chain lowTankThreshold (== refill amount)
  const activeCritical = faucet.active.lowTankThreshold // Changed from mon.lowTankThreshold
  const linkCritical = faucet.link.lowTankThreshold

  // Calculate vault status levels
  const activeStatus = useStatus(faucet.vaultActive, activeCritical)  // Changed from monStatus and vaultMon
  const linkStatus = useStatus(faucet.vaultLink, linkCritical)

  // Validate withdrawal amount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
        setIsWithdrawValid(true)
        return
      }

      const amount = parseFloat(withdrawAmount)
      
      // Calculate treasury balance (total balance minus reservoir)
      // This matches the Faucet.sol contract logic
      const totalActiveBalance = faucet.vaultActive + faucet.active.tankBalance
      const activeTreasuryBalance = totalActiveBalance > faucet.vaultActive ? totalActiveBalance - faucet.vaultActive : 0
      
      const totalLinkBalance = faucet.vaultLink + faucet.link.tankBalance
      const linkTreasuryBalance = totalLinkBalance > faucet.vaultLink ? totalLinkBalance - faucet.vaultLink : 0
      
      const maxAmount = withdrawToken === "active" ? activeTreasuryBalance : linkTreasuryBalance
      setIsWithdrawValid(amount <= maxAmount)
    }, 300)

    return () => clearTimeout(timer)
  }, [withdrawAmount, withdrawToken, faucet.vaultActive, faucet.vaultLink, faucet.active.tankBalance, faucet.link.tankBalance])

  // Memoize button state to prevent flickering
  const withdrawButtonState = useMemo(() => ({
    disabled: !isWithdrawValid || !withdrawAmount || parseFloat(withdrawAmount) <= 0,
    text: withdrawAmount ? `Withdraw ${withdrawAmount} ${withdrawToken.toUpperCase()}` : 'Enter amount'
  }), [isWithdrawValid, withdrawAmount, withdrawToken])

  // Currently unused in UI – retained for future animation enhancements
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_stableAnimated, setStableAnimated] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setStableAnimated(isWithdrawValid)
    }, 150) // Increased debounce from 50ms to 150ms
    
    return () => clearTimeout(timer)
  }, [isWithdrawValid])

  const handleRefreshBalances = async () => {
    setIsRefreshing(true)
    try {
      console.log('🔄 Manual refresh triggered - bypassing cache...')
      
      // Use fresh version that bypasses cache
      await refreshVaultBalances()
      
      console.log('✅ Manual refresh completed - fresh data loaded from blockchain')
    } catch (error) {
      console.error('Failed to refresh vault balances:', error)
    } finally {
      setIsRefreshing(false)
    }
  }



  const renderVaultAlert = (tokenType: "active" | "link", status: typeof activeStatus) => {
    if (status.level === "good") return null

    const type = status.level === "critical" ? "error" : "warning"
    const title = status.level === "critical" ? "Critical Vault Level" : "Low Vault Level"
    const tokenSymbol = tokenType === "active" ? (derivedConfig?.nativeSymbol || 'NATIVE') : 'LINK'
    const message = status.level === "critical" 
      ? `${tokenSymbol} vault is empty. Refuel operations may fail.`
      : `${tokenSymbol} vault is running low. Consider topping up soon.`

    return (
      <StatusAlert 
        type={type}
        title={title}
        message={message}
        className="mt-3"
      />
    )
  }

  return (
    <TooltipProvider>
    <Card className="bg-white/10 backdrop-blur-sm border-white/20">
      <CardContent className="space-y-4 lg:space-y-6 p-4 lg:p-6">
          {/* Vault Overview - Clean without redundant title */}
        <div className="flex items-center justify-between mb-4">
            <p className="font-body text-white/70 text-sm">Deep reserves that refill tanks via fuel button (🔋)</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleRefreshBalances}
                disabled={isRefreshing}
                size="sm"
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 p-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refresh vault balances from blockchain</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
          {/* Native Token Vault */}
          <StatusCard
            title={`${derivedConfig?.nativeSymbol || 'MON'} Vault`}
            status={activeStatus.level} // Changed from monStatus
            value={faucet.vaultActive} // Changed from vaultMon
            unit={derivedConfig?.nativeSymbol || 'MON'}
            subtitle="Reserves:"
            alerts={renderVaultAlert("active", activeStatus)}
          />

          {/* LINK Vault */}
          <StatusCard
            title="LINK Vault"
            status={linkStatus.level}
            value={faucet.vaultLink}
            unit="LINK"
            subtitle="Reserves:"
            alerts={renderVaultAlert("link", linkStatus)}
          />
        </div>

        {/* Admin Controls - Only visible to owners */}
        {isOwner && (
          <div className="bg-white/5 rounded-lg p-4 lg:p-6 border border-white/20">
            <h4 className="font-body font-semibold text-white text-base lg:text-lg mb-4 flex items-center space-x-2">
              <Shield className="h-3 w-3 lg:h-4 lg:w-4 text-yellow-400" />
              <span>Admin Controls</span>
            </h4>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Faucet Contract Address */}
                  <ContractAddress
                    address={addresses?.FAUCET_ADDRESS || ''}
                    label="Faucet Contract:"
                    className="w-full"
                  />

                  {addresses?.HELPER_ADDRESS && (
                    <ContractAddress
                      address={addresses.HELPER_ADDRESS}
                      label="Helper Contract:"
                      chain="helper"
                      className="w-full"
                    />
                  )}
                </div>
                </div>

                {/* Withdraw Section */}
                <div className="space-y-3">
                  <h5 className="font-body font-medium text-white text-sm">Emergency Withdraw</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="token-select" className="font-body text-white/80 text-xs">
                          Token
                        </Label>
                        <select
                        id="token-select"
                          value={withdrawToken}
                          onChange={(e) => setWithdrawToken(e.target.value as "active" | "link")}
                        className="w-full bg-white/10 border border-white/30 rounded text-white text-sm p-2 h-10 font-body focus-natural"
                        >
                        <option value="active" className="bg-black">
                          {derivedConfig?.nativeSymbol || 'MON'}
                        </option>
                        <option value="link" className="bg-black">
                          LINK
                        </option>
                        </select>
                      </div>
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount" className="font-body text-white/80 text-xs">
                          Amount
                        </Label>
                        <Input
                        id="withdraw-amount"
                          type="number"
                        placeholder="Enter amount"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="bg-white/10 border-white/30 text-white placeholder:text-white/90"
                      />
                      {/* Validation text for over-withdrawal */}
                      {!isWithdrawValid && withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                        <p className="font-body text-xs text-red-400 mt-1">
                          Amount exceeds available treasury balance.
                        </p>
                      )}
                    </div>
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <ActionButton
                        variant="red"
                        state={withdrawButtonState.disabled ? "disabled" : "enabled"}
                        icon={<Minus className="h-4 w-4" />}
                        rightIcon={<Info className="h-3 w-3" />}
                        fullWidth
                        animated={false}  // Disable pulse animation to prevent flicker
                        tooltip="Emergency withdrawal from vault reserves (admin only)"
                      >
                        {withdrawButtonState.text}
                      </ActionButton>
                    </DialogTrigger>
                        <DialogContent variant="glass">
                          <DialogHeader>
                            <DialogTitle className="font-body text-white">Confirm Emergency Withdrawal</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                              <div className="flex items-start space-x-2">
                                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-body text-red-400 font-semibold text-sm">Emergency Withdrawal Warning</p>
                                  <p className="font-body text-red-300 text-xs">
                                    This will reduce vault reserves and may affect the faucet's ability to refill tanks.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="font-body text-white/90 text-sm">
                                <span className="font-medium">Amount:</span> {withdrawAmount} {withdrawToken.toUpperCase()}
                              </p>
                              <p className="font-body text-white/90 text-sm">
                                <span className="font-medium">Remaining:</span>{" "}
                                {withdrawToken === "active"
                                  ? faucet.vaultActive - parseFloat(withdrawAmount || "0") // Changed from vaultMon
                                  : faucet.vaultLink - parseFloat(withdrawAmount || "0")}{" "}
                                {withdrawToken.toUpperCase()}
                              </p>
                            </div>

                            <div className="flex space-x-3">
                              <DialogClose asChild>
                                <Button variant="ghost" className="flex-1 bg-white/10 backdrop-blur-sm border border-white/30 text-white hover:bg-white/20">
                                  Cancel
                                </Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  className="flex-1 bg-red-600/30 backdrop-blur-sm border border-red-500/40 hover:bg-red-600/50 text-white"
                                  onClick={async () => {
                                    if (!walletClient) return
                                    if (!isWithdrawValid) return

                                    try {
                                      const amountWei = parseEther(withdrawAmount as `${string}`)

                                      const faucetAbi = parseAbi([
                                        'function emergencyWithdrawMon(address to,uint256 amount)',
                                        'function emergencyWithdrawLink(address to,uint256 amount)',
                                      ])

                                      const functionName = withdrawToken === 'active'
                                        ? 'emergencyWithdrawMon'
                                        : 'emergencyWithdrawLink'

                                      const txHash = await walletClient.sendTransaction({
                                        account: walletClient.account,
                                        to: (addresses?.FAUCET_ADDRESS || '') as `0x${string}`,
                                        data: encodeFunctionData({
                                          abi: faucetAbi,
                                          functionName,
                                          args: [walletClient.account.address as `0x${string}` , amountWei],
                                        }),
                                        value: 0n,
                                        chain: walletClient.chain,  // Add missing chain parameter
                                      })

                                      console.log('⏳ Waiting for emergency withdraw tx...', txHash)
                                      await publicClient.waitForTransactionReceipt({ hash: txHash })

                                      console.log('✅ Emergency withdrawal confirmed')

                                      // Refresh balances after withdrawal
                                      await refreshVaultBalances()

                                    } catch (error) {
                                      console.error('Emergency withdrawal failed', error)
                                    } finally {
                                    setWithdrawAmount("")
                                    }
                                  }}
                                >
                                  Confirm Withdrawal
                                </Button>
                              </DialogClose>
                            </div>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  )
}

// Wrap with React.memo to prevent unnecessary re-renders that cause flickering
export const VaultStatus = React.memo(VaultStatusComponent)
