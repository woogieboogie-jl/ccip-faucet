# Monad CCIP Faucet - Contract Deployment

Contains contracts for monad-ccip-faucet project

## Contract Overview

### (1) What Faucet.sol does
Faucet.sol is a dual-reservoir faucet contract that dispenses native and LINK tokens to users. It features dynamic drip amounts based on volatility data received via Chainlink CCIP from a helper on a configured helper chain. Key functions include `requestNativeTokens()`, `requestLinkTokens()`, `triggerRefillCheck()` for CCIP-based reservoir refilling, and various admin functions for managing cooldowns, capacities, and emergency operations.

### (2) What VolatilityHelper.sol does  
VolatilityHelper.sol is a stateless CCIP application deployed on Avalanche Fuji that responds with ETH/USD 24-hour realized volatility data. It receives CCIP messages from the Faucet contract, fetches current volatility from Chainlink price feeds, and sends the volatility index back to adjust the faucet's drip rates dynamically based on market conditions.

## Deployment Process

We're going to deploy using foundry scripts:

1. **DeployFaucet.s.sol** - deploys your faucet contract with initial values (initial drip values, etc) on Monad
2. **DeployVolatilityHelper.s.sol** - deploys your volatility helper (gets volatility index from the volatility feed) on Fuji. It reads the active-chain faucet address from the JSON configs.
3. **ConfigureFaucet.s.sol** - configures your Faucet contract to enable receiving messages from your deployed VolatilityHelper on Avalanche. It reads helper selector and address from the JSON configs (with optional env override for `HELPER_ADDRESS`).

## Step-by-Step Deployment

### [Environment]
- Only secrets are loaded from env: `FAUCET_PRIVATE_KEY`, RPC URLs.
- Contract addresses/selectors are read from JSON configs. Avoid .env for addresses.

### [Deploy Faucet.sol]
```bash
forge script script/DeployFaucet.s.sol:DeployFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast -vvvv
```

### [Update Configs]
Set the deployed Faucet address in:
`../ccip-faucet-fe/public/configs/chains/<CHAIN_NAME>.json` → `contracts.faucet`

### [Deploy VolatilityHelper.sol]
```bash
forge script script/DeployVolatilityHelper.s.sol:DeployVolatilityHelper --rpc-url $AVALANCHE_FUJI_RPC_URL --broadcast -vvvv
```

### [Update Configs]
Set the deployed Helper address in:
`../ccip-faucet-fe/public/configs/chains/helpers/<HELPER_NAME>.json` → `contracts.helper`

### [Configure Faucet.sol]
Map helper to faucet via JSON-driven script:
```bash
forge script script/ConfigureFaucet.s.sol:ConfigureFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast -vvvv
```

## Example Deployed Addresses
```bash
FAUCET_ADDRESS=0x0638dED53d44c38fed362F987feacAf067357509
HELPER_ADDRESS=0xb8985AC25eE965e8812E33bc618a3a62e69e648B
```

## Fund Contracts
Send LINK to both Faucet (Monad) and Helper (Avalanche) contracts - around 10-20 LINK should suffice for testing.

## Trigger Refill Requests
```bash
source .env && cast send --rpc-url $MONAD_TESTNET_RPC_URL --private-key $FAUCET_PRIVATE_KEY --legacy --gas-limit 6000000 $FAUCET_ADDRESS "triggerRefillCheck()"
```

## Link Frontend
The frontend reads contract addresses from the same JSON configs. Just update the JSON files and refresh/rebuild the app.

**Start Frontend:**
```bash
cd .. && pnpm run dev:frontend
```

Happy Hacking! 🚀

## Contract Verification

### Verify Faucet.sol
```bash
forge verify-contract --rpc-url https://testnet-rpc.monad.xyz --verifier sourcify --verifier-url 'https://sourcify-api-monad.blockvision.org' $FAUCET_ADDRESS src/Faucet.sol:Faucet --flatten
```

### Verify VolatilityHelper.sol
```bash
forge verify-contract --chain-id 43113 --verifier etherscan --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api" $HELPER_ADDRESS src/VolatilityHelper.sol:VolatilityHelper --flatten --etherscan-api-key "YourApiKeyToken"
```
