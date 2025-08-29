import { Abi } from 'viem'

export const faucetAbi = [
  {
    type: 'function',
    name: 'getReservoirStatus',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'activePool', type: 'uint256' },  // Generic: was 'monPool'
      { name: 'activeDripRate', type: 'uint256' },  // Generic: was 'monDripRate'
      { name: 'linkPool', type: 'uint256' },
      { name: 'linkDripRate', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'requestNativeTokens',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'requestNativeTokensTo',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'requestLinkTokens',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'triggerRefillCheck',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refillInProgress',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getTreasuryStatus',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'activeTreasury', type: 'uint256' },  // Generic: was 'monTreasury'
      { name: 'activeReservoir', type: 'uint256' },  // Generic: was 'monReservoir'
      { name: 'linkTreasury', type: 'uint256' },
      { name: 'linkReservoir', type: 'uint256' },
      { name: 'activeCapacity', type: 'uint256' },  // Generic: was 'monCapacity'
      { name: 'linkCapacity', type: 'uint256' },
    ],
  },
  // Global constants
  {
    type: 'function',
    name: 'COOLDOWN',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'thresholdFactor',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Base drip rates (deployment constants)
  {
    type: 'function',
    name: 'BASENATIVEDRIPRATE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'BASELINKDRIPRATE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // User-specific timestamps
  {
    type: 'function',
    name: 'lastClaimNative',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lastClaimLink',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Admin functions
  {
    type: 'function',
    name: 'emergencyResetRefillState',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'messageIds', type: 'bytes32[]' }],
    outputs: [],
  },
] as const satisfies Abi 