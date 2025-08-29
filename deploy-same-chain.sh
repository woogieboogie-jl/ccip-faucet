#!/bin/bash

# Same-Chain Deployment Script for Avalanche Fuji
# Usage: ./deploy-same-chain.sh

set -e

CHAIN_NAME="avalanche-fuji"
HELPER_NAME="avalanche-fuji"  # Same chain for same-chain deployment

echo "🚀 Starting Same-Chain Deployment for $CHAIN_NAME"
echo "=================================================="
echo ""

# Check required environment variables
echo "📋 Checking environment variables..."
if [[ -z "$AVALANCHE_FUJI_RPC_URL" ]]; then
    echo "[ERROR] AVALANCHE_FUJI_RPC_URL not set"
    exit 1
fi

if [[ -z "$FAUCET_PRIVATE_KEY" ]]; then
    echo "[ERROR] FAUCET_PRIVATE_KEY not set"
    exit 1
fi

echo "✅ Environment variables OK"
echo ""

# Step 1: Deploy Faucet Contract
echo "🔧 Step 1: Deploying Faucet Contract on $CHAIN_NAME..."
cd ccip-faucet-contracts

export CHAIN_NAME="$CHAIN_NAME"
export HELPER_NAME="$HELPER_NAME"
export INITIAL_FUND=${INITIAL_FUND:-1000000000000000000}  # 1 AVAX default

echo "   Chain: $CHAIN_NAME"
echo "   Helper: $HELPER_NAME (same-chain)"
echo "   Initial Fund: $INITIAL_FUND wei"
echo ""

forge script script/DeployFaucet.s.sol:DeployFaucet \
  --rpc-url "$AVALANCHE_FUJI_RPC_URL" \
  --broadcast \
  --verify || {
    echo "[ERROR] Faucet deployment failed"
    exit 1
}

echo "✅ Faucet deployed successfully"
echo ""

# Step 2: Extract deployed address
echo "🔍 Step 2: Extracting deployed faucet address..."

# Get the latest deployment from broadcast directory
BROADCAST_DIR="broadcast/DeployFaucet.s.sol/43113"  # Avalanche Fuji chain ID
if [[ ! -d "$BROADCAST_DIR" ]]; then
    echo "[ERROR] Broadcast directory not found: $BROADCAST_DIR"
    exit 1
fi

# Get the latest run file
LATEST_RUN=$(ls -t "$BROADCAST_DIR"/run-*.json | head -1)
if [[ -z "$LATEST_RUN" ]]; then
    echo "[ERROR] No deployment run files found"
    exit 1
fi

# Extract faucet address from deployment
FAUCET_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "Faucet") | .contractAddress' "$LATEST_RUN")
if [[ -z "$FAUCET_ADDRESS" || "$FAUCET_ADDRESS" == "null" ]]; then
    echo "[ERROR] Could not extract faucet address from deployment"
    exit 1
fi

echo "✅ Faucet deployed at: $FAUCET_ADDRESS"
echo ""

# Step 3: Update configuration files
echo "📝 Step 3: Updating configuration files..."
cd ..

CONFIG_FILE="ccip-faucet-fe/public/configs/chains/avalanche-fuji.json"
HELPER_CONFIG_FILE="ccip-faucet-fe/public/configs/chains/helpers/avalanche-fuji.json"

# Update main config with faucet address
jq --arg addr "$FAUCET_ADDRESS" '.contracts.faucet = $addr' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
echo "✅ Updated $CONFIG_FILE with faucet address"

# Get volatility feed address from helper config
VOLATILITY_FEED=$(jq -r '.contracts.volatilityFeed' "$HELPER_CONFIG_FILE")
if [[ -z "$VOLATILITY_FEED" || "$VOLATILITY_FEED" == "null" ]]; then
    echo "[ERROR] Volatility feed address not found in $HELPER_CONFIG_FILE"
    exit 1
fi

echo "✅ Using volatility feed: $VOLATILITY_FEED"
echo ""

# Step 4: Configure same-chain mapping
echo "⚙️  Step 4: Configuring same-chain mapping..."

# Get chain selector from config
CHAIN_SELECTOR=$(jq -r '.common.chainSelector' "ccip-faucet-fe/public/configs/chains/avalanche-fuji.json")

echo "   Faucet: $FAUCET_ADDRESS"
echo "   Chain Selector: $CHAIN_SELECTOR"
echo "   Volatility Feed: $VOLATILITY_FEED"
echo ""

# Configure faucet to trust the volatility feed (same-chain setup)
cast send "$FAUCET_ADDRESS" "addChain(uint64,address)" \
  "$CHAIN_SELECTOR" \
  "$VOLATILITY_FEED" \
  --private-key "$FAUCET_PRIVATE_KEY" \
  --rpc-url "$AVALANCHE_FUJI_RPC_URL" || {
    echo "[ERROR] Failed to configure same-chain mapping"
    exit 1
}

echo "✅ Same-chain mapping configured successfully"
echo ""

# Step 5: Fund the faucet
echo "💰 Step 5: Funding the faucet with LINK..."

cd ccip-faucet-contracts
export TARGET="active"
export AMOUNT=${FUND_AMOUNT:-5000000000000000000}  # 5 LINK default

echo "   Funding amount: $AMOUNT wei ($(cast --to-unit "$AMOUNT" ether) LINK)"

CHAIN_NAME="$CHAIN_NAME" TARGET="$TARGET" AMOUNT="$AMOUNT" \
forge script script/FundContracts.s.sol:FundContracts \
  --rpc-url "$AVALANCHE_FUJI_RPC_URL" \
  --broadcast || {
    echo "[ERROR] Failed to fund faucet"
    exit 1
}

echo "✅ Faucet funded successfully"
echo ""

# Step 6: Run preflight checks
echo "🔍 Step 6: Running same-chain preflight checks..."
cd ..

CHAIN_NAME="$CHAIN_NAME" ./preflight-check-same-chain.sh || {
    echo "[ERROR] Preflight checks failed"
    exit 1
}

echo ""
echo "🎉 SAME-CHAIN DEPLOYMENT COMPLETE!"
echo "=================================="
echo ""
echo "📋 Deployment Summary:"
echo "   Chain: $CHAIN_NAME"
echo "   Faucet Address: $FAUCET_ADDRESS"
echo "   Volatility Feed: $VOLATILITY_FEED"
echo "   Chain Selector: $CHAIN_SELECTOR"
echo ""
echo "🚀 Ready to test! Run:"
echo "   cast send $FAUCET_ADDRESS \"triggerRefillCheck()\" \\"
echo "     --private-key \$FAUCET_PRIVATE_KEY \\"
echo "     --rpc-url \$AVALANCHE_FUJI_RPC_URL"
echo ""
echo "✨ Same-chain advantages:"
echo "   ✅ No CCIP fees (80% cheaper)"
echo "   ✅ Instant volatility updates"
echo "   ✅ Direct price feed access"
echo "   ✅ Simplified architecture"
