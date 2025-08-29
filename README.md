# CCIP Faucet

A multi-chain faucet system using Chainlink CCIP for cross-chain volatility-based refill automation.

## Architecture

- **Active Chains**: Multi-chain faucet deployment supporting:
  - **Monad Testnet** (Chain ID: 10143)
  - **Ethereum Sepolia** (Chain ID: 11155111) 
  - **Avalanche Fuji** (Chain ID: 43113)
- **Helper Chain**: Avalanche Fuji (provides volatility data via Chainlink oracles)
- **CCIP Flow**: Active Chain → Helper Chain → Active Chain
- **Frontend**: Dynamic multi-chain UI with automatic chain detection and switching

## Quick Start

### 1. Deploy Contracts

See detailed deployment instructions in [`ccip-faucet-contracts/DEPLOYMENT.md`](ccip-faucet-contracts/DEPLOYMENT.md).

### 2. Frontend Setup

Deploy the multi-chain frontend interface:

```bash
# Navigate to frontend directory
cd ccip-faucet-fe

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and RPC URLs

# Start development server
npm run dev

# Build for production
npm run build
```

### 3. Pre-Flight Testing

Before triggering CCIP, run comprehensive checks:

```bash
# Install dependencies (one time)
npm install

# Run pre-flight checks
npm run preflight

# Alternative: shell script version
./preflight-check.sh
```

### 4. Trigger CCIP

If pre-flight passes:

```bash
cast send $FAUCET_ADDR "triggerRefillCheck()" \
  --private-key $FAUCET_PRIVATE_KEY \
  --rpc-url $ACTIVE_CHAIN_RPC_URL
```

## Pre-Flight Checks

The pre-flight scripts verify:

- ✅ **Contract Deployments**: Both faucet and helper contracts exist
- ✅ **Cross-Chain Mappings**: Proper whitelisting between contracts
- ✅ **LINK Balances**: Sufficient LINK tokens for CCIP fees
- ✅ **Volatility Feed**: Oracle connectivity and data validity
- ✅ **Faucet State**: Ready for refill (not in progress, needs refill)
- ✅ **Owner Verification**: Consistent ownership across contracts

**Important:** The volatility feed check prevents the common "execution reverted" error when CCIP messages fail due to oracle issues.

## Scripts

- **`preflight-check.ts`**: TypeScript version with detailed error reporting
- **`preflight-check.sh`**: Shell script version using `cast` and `jq`
- **`package.json`**: Manages TypeScript dependencies and scripts

## Configuration

All addresses and chain parameters are stored in JSON configuration files:

- **Active Chains**: `ccip-faucet-fe/public/configs/chains/*.json`
- **Helper Chains**: `ccip-faucet-fe/public/configs/chains/helpers/*.json`

Environment variables are only used for secrets (private keys, RPC URLs).

## Troubleshooting

### Common Issues

1. **"Volatility feed check failed"**
   - Update the `volatilityFeed` address in your helper chain JSON
   - Redeploy the helper contract with correct oracle address

2. **"Invalid sender" on helper chain**
   - Ensure `ConfigureFaucet` and `ConfigureHelper` scripts were run
   - Verify cross-chain mappings in pre-flight checks

3. **"Insufficient LINK"**
   - Fund both contracts: `forge script FundContracts`

4. **"Contract not found"**
   - Verify addresses in JSON configs match deployed contracts
   - Check you're on the correct network

### Getting Help

- Run pre-flight checks first: `npm run preflight`
- Check deployment guide: `ccip-faucet-contracts/DEPLOYMENT.md`
- Verify JSON configurations are updated with deployed addresses

## Development

The pre-flight scripts use:

- **TypeScript**: `viem` for multi-chain queries, `dotenv` for environment variables
- **Shell**: `cast` for blockchain queries, `jq` for JSON parsing

Both versions provide the same checks with different implementation approaches.