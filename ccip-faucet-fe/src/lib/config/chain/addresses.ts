import { getChainConstants } from './viem-client'

// CONFIG-DRIVEN ADDRESSES ONLY
// All contract addresses are now loaded from configuration files
let configAddresses: {
  FAUCET_ADDRESS: string
  HELPER_ADDRESS: string
  ACTIVE_CHAIN_LINK_TOKEN: string
  HELPER_CHAIN_LINK_TOKEN: string
  ACTIVE_CHAIN_CCIP_ROUTER: string
  HELPER_CHAIN_CCIP_ROUTER: string
} | null = null

/**
 * Clear addresses cache (called when switching chains)
 */
export function clearAddressesCache(): void {
  console.log('🧹 Clearing addresses cache for chain switch')
  configAddresses = null
}

/**
 * Get all contract addresses from configuration
 */
export async function getAddresses() {
  if (!configAddresses) {
    const constants = await getChainConstants()
    configAddresses = {
      FAUCET_ADDRESS: constants.FAUCET_ADDRESS,
      HELPER_ADDRESS: constants.HELPER_ADDRESS,
      ACTIVE_CHAIN_LINK_TOKEN: constants.ACTIVE_CHAIN_LINK_TOKEN,
      HELPER_CHAIN_LINK_TOKEN: constants.HELPER_CHAIN_LINK_TOKEN,
      ACTIVE_CHAIN_CCIP_ROUTER: constants.ACTIVE_CHAIN_CCIP_ROUTER,
      HELPER_CHAIN_CCIP_ROUTER: constants.HELPER_CHAIN_CCIP_ROUTER,
    }
  }
  return configAddresses
}

/**
 * Get faucet address from configuration
 */
export async function getFaucetAddress(): Promise<string> {
  const addresses = await getAddresses()
  return addresses.FAUCET_ADDRESS
}

/**
 * Get helper address from configuration
 */
export async function getHelperAddress(): Promise<string> {
  const addresses = await getAddresses()
  return addresses.HELPER_ADDRESS
}

/**
 * Get LINK token address for active chain
 */
export async function getLinkTokenAddress(): Promise<string> {
  const addresses = await getAddresses()
  return addresses.ACTIVE_CHAIN_LINK_TOKEN
}

/**
 * Get CCIP router address for active chain
 */
export async function getCCIPRouterAddress(): Promise<string> {
  const addresses = await getAddresses()
  return addresses.ACTIVE_CHAIN_CCIP_ROUTER
}

/**
 * Initialize addresses cache
 * Call this early in your app initialization
 */
export async function initializeAddresses() {
  await getAddresses()
  console.log('✅ Contract addresses initialized from configuration')
} 