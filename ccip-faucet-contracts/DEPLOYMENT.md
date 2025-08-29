# Faucet Deployment Guide

This guide explains how to deploy the Faucet contract to different chains using the chain-agnostic deployment script.

## Prerequisites

1. **Environment Variables (secrets only):**
   ```bash
   export FAUCET_PRIVATE_KEY="your_private_key_here"
   export ETHEREUM_SEPOLIA_RPC_URL="your_sepolia_rpc_url"
   export MONAD_TESTNET_RPC_URL="your_monad_rpc_url"
   export AVALANCHE_FUJI_RPC_URL="your_fuji_rpc_url"
   ```

2. **Chain Configurations (single source of truth):**
   - Config files are located in `../ccip-faucet-fe/public/configs/chains/`
   - Helpers in `../ccip-faucet-fe/public/configs/chains/helpers/`
   - Update these JSONs with deployed addresses. Avoid .env for addresses.

## Testing Configuration

Before deploying, test that the JSON config parsing works:

```bash
# Test Monad Testnet config
CHAIN_NAME=monad-testnet HELPER_NAME=avalanche-fuji forge script TestConfig

# Test Ethereum Sepolia config  
CHAIN_NAME=ethereum-sepolia HELPER_NAME=avalanche-fuji forge script TestConfig
```

Expected output:
```
=== Testing Config for Chain: monad-testnet
Config path: /path/to/configs/chains/monad-testnet.json
✅ Config file read successfully
✅ Router: 0x5f16e51e3Dcb255480F090157DD01bA962a53E54
✅ LINK Token: 0x6fE981Dbd557f81ff66836af0932cba535Cbc343
✅ Chain Selector: 2183018362218727504
✅ Chain ID: 10143
✅ Chain Name: Monad Testnet
=== All config fields parsed successfully! ===
```

## Deployment Commands

### Deploy Faucet to Any Supported Chain

The deployment script is chain-agnostic. Use the appropriate `CHAIN_NAME` and RPC URL:

```bash
cd ccip-faucet-contracts

# Deploy to Monad Testnet
CHAIN_NAME=monad-testnet HELPER_NAME=avalanche-fuji forge script DeployFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast

# Deploy to Ethereum Sepolia  
CHAIN_NAME=ethereum-sepolia HELPER_NAME=avalanche-fuji forge script DeployFaucet --rpc-url $ETHEREUM_SEPOLIA_RPC_URL --broadcast

# Deploy to Avalanche Fuji
CHAIN_NAME=avalanche-fuji HELPER_NAME=avalanche-fuji forge script DeployFaucet --rpc-url $AVALANCHE_FUJI_RPC_URL --broadcast

# Custom initial fund (any chain)
CHAIN_NAME=your-chain INITIAL_FUND=2000000000000000000 forge script DeployFaucet --rpc-url $YOUR_CHAIN_RPC_URL --broadcast
```

### Deploy Volatility Helper (Fuji)

```bash
cd ccip-faucet-contracts

CHAIN_NAME=monad-testnet HELPER_NAME=avalanche-fuji \
forge script script/DeployVolatilityHelper.s.sol:DeployVolatilityHelper \
  --rpc-url $AVALANCHE_FUJI_RPC_URL \
  --broadcast
```

### Supported Chain Names

Use these exact chain names in the `CHAIN_NAME` environment variable:

- `monad-testnet` - Monad Testnet (Chain ID: 10143)
- `ethereum-sepolia` - Ethereum Sepolia (Chain ID: 11155111)  
- `avalanche-fuji` - Avalanche Fuji (Chain ID: 43113)

Each chain name corresponds to a configuration file in `../ccip-faucet-fe/public/configs/chains/`.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CHAIN_NAME` | ✅ Yes | - | Chain config name (e.g., `monad-testnet`, `ethereum-sepolia`) |
| `FAUCET_PRIVATE_KEY` | ✅ Yes | - | Private key for deployment |
| `INITIAL_FUND` | ❌ No | `1 ether` | Initial native sent with deployment |

## Post-Deployment Steps

1. **Update Configs (source of truth):**
   - Active chain JSON: set `contracts.faucet`
   - Helper chain JSON: set `contracts.helper` and ensure `contracts.volatilityFeed`

2. **Deploy VolatilityHelper (JSON-driven):** (see above)

3. **Configure Faucet (JSON-driven):**
   ```bash
   CHAIN_NAME=monad-testnet HELPER_NAME=avalanche-fuji \
   forge script script/ConfigureFaucet.s.sol:ConfigureFaucet \
     --rpc-url $MONAD_TESTNET_RPC_URL \
     --broadcast
   ```

4. **Fund Contracts with LINK (JSON-driven):**
   ```bash
   # Fund Faucet (active chain)
   CHAIN_NAME=monad-testnet TARGET=active AMOUNT=1000000000000000000 \
   forge script script/FundContracts.s.sol:FundContracts --rpc-url $MONAD_TESTNET_RPC_URL --broadcast

   # Fund Helper (helper chain)
   CHAIN_NAME=monad-testnet HELPER_NAME=avalanche-fuji TARGET=helper AMOUNT=1000000000000000000 \
   forge script script/FundContracts.s.sol:FundContracts --rpc-url $AVALANCHE_FUJI_RPC_URL --broadcast
   ```

5. **Export deployed addresses for verification (from updated JSONs):**
   ```bash
   export FAUCET_ADDR=$(jq -r '.contracts.faucet' ../ccip-faucet-fe/public/configs/chains/monad-testnet.json)
   export HELPER_ADDR=$(jq -r '.contracts.helper' ../ccip-faucet-fe/public/configs/chains/helpers/avalanche-fuji.json)
   echo Faucet: $FAUCET_ADDR
   echo Helper: $HELPER_ADDR
   ```

## Troubleshooting

### Common Issues

1. **"Config missing: common.ccipRouter"**
   - Check that the chain config file exists
   - Verify JSON structure matches expected format

2. **"Failed to parse common.ccipRouter"**
   - Ensure the address is valid (0x... format)
   - Check for JSON syntax errors

3. **"The path is not allowed to be accessed"**
   - Verify `fs_permissions` in `foundry.toml`
   - Check file path is correct

4. **"CHAIN_NAME not found"**
   - Set the environment variable: `export CHAIN_NAME=monad-testnet`

## Pre-Flight Testing

Before triggering CCIP, run comprehensive checks to ensure everything is properly configured:

### Option A: TypeScript Pre-Flight (Recommended)
```bash
# Install dependencies (one time)
cd ../ccip-faucet  # Go to parent directory
npm install

# Run pre-flight checks
npm run preflight
```

### Option B: Shell Script Pre-Flight
```bash
cd ../ccip-faucet  # Go to parent directory
./preflight-check.sh
```

### Pre-Flight Checks Include:
- ✅ **Contract Deployments**: Verify faucet and helper contracts exist
- ✅ **Cross-Chain Mappings**: Check `trustedSenders` and `selectorToFaucet` mappings
- ✅ **LINK Balances**: Ensure both contracts have sufficient LINK for fees
- ✅ **Volatility Feed**: Test oracle connectivity and data validity (**This catches oracle issues!**)
- ✅ **Faucet State**: Verify no active refill and reservoirs need refilling
- ✅ **Owner Verification**: Confirm consistent ownership

**Expected Output:**
```
=== CCIP Pre-Flight Checks ===
Active Chain: monad-testnet
Helper Chain: avalanche-fuji

=== 4. Volatility Feed ===
Volatility Feed Address: 0x86d67c3D38D2bCeE722E601025C25a575021c6EA
Feed Description: ETH / USD
Latest Price: 350000000000 (raw value)
Last Updated: 2024-01-15T10:30:00.000Z
[OK] Volatility feed is working and data is recent

=== Summary ===
[READY] CCIP ready! All checks passed.
Run: cast send 0x... "triggerRefillCheck()" --private-key $FAUCET_PRIVATE_KEY --rpc-url $MONAD_TESTNET_RPC_URL
```

**⚠️ Important:** If volatility feed fails, update the `volatilityFeed` address in your helper chain JSON config and redeploy the helper.

### Verification Commands

```bash
# Check if config file exists
ls ../ccip-faucet-fe/public/configs/chains/

# Validate JSON syntax
cat ../ccip-faucet-fe/public/configs/chains/monad-testnet.json | jq .

# Test specific chain
CHAIN_NAME=monad-testnet forge script TestConfig
```

## Architecture Notes

- **Active Chain:** The chain where Faucet is deployed (Monad/Ethereum Sepolia)
- **Helper Chain:** Fuji testnet (always the same)
- **CCIP Flow:** Active Chain → Fuji → Active Chain
- **Config Source:** JSON files in frontend configs directory
- **Chain Selector:** From helper JSON 