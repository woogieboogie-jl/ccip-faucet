// Vault thresholds
export const VAULT_THRESHOLDS = {
  mon: { critical: 5000, warning: 10000 },
  link: { critical: 1000, warning: 2000 },
} as const

// Tank thresholds (percentage of max capacity)
export const TANK_THRESHOLD_PERCENTAGE = 0.3

// Copy feedback duration
export const COPY_FEEDBACK_DURATION = 2000 // 2 seconds

// Animation durations
export const ANIMATION_DURATIONS = {
  drip: 800,
  button: 200,
  tooltip: 150,
} as const

// Explorer URLs
export const EXPLORER_URLS = {
  ethereum: "https://etherscan.io",
  sepolia: "https://sepolia.etherscan.io",
} as const

// API endpoints
export const API_ENDPOINTS = {
  volatility: "/api/volatility",
  ccip: "/api/ccip",
} as const

// Default values
export const DEFAULTS = {
  volatility: {
    multiplier: 1.0,
    updateInterval: 30 * 60 * 1000, // 30 minutes
  },
  ui: {
    addressTruncation: { start: 6, end: 4 },
    numberFormatting: { decimals: 2 },
  },
} as const

// Validation rules
export const VALIDATION = {
  address: /^0x[a-fA-F0-9]{40}$/,
  amount: {
    min: 0.000001,
    max: 1000000,
  },
} as const 

// Network configuration
export const NETWORKS = {
  MONAD_TESTNET: {
    name: "Monad Testnet",
    chainId: 10143,
    rpcUrl: import.meta.env.VITE_MONAD_TESTNET_RPC_URL,
  }
} as const

// REMOVED: Hardcoded cooldown durations - now read from contract via getFaucetSnapshot
// This ensures the frontend always uses the correct on-chain cooldown values 