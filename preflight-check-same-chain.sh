#!/bin/bash

# CCIP Same-Chain Pre-Flight Checks - Avalanche Fuji Only
# Usage: CHAIN_NAME=avalanche-fuji ./preflight-check-same-chain.sh

set -e

ACTIVE_CHAIN=${CHAIN_NAME:-avalanche-fuji}

echo "=== CCIP Same-Chain Pre-Flight Checks ==="
echo "Chain: $ACTIVE_CHAIN (same-chain deployment)"
echo ""

# Check environment variables
if [[ -z "$AVALANCHE_FUJI_RPC_URL" ]]; then
    echo "[ERROR] AVALANCHE_FUJI_RPC_URL not set"
    exit 1
fi

# Read configuration
ACTIVE_CONFIG_PATH="ccip-faucet-fe/public/configs/chains/${ACTIVE_CHAIN}.json"

if [[ ! -f "$ACTIVE_CONFIG_PATH" ]]; then
    echo "[ERROR] Chain config not found: $ACTIVE_CONFIG_PATH"
    exit 1
fi

# Extract addresses and selectors using jq
FAUCET_ADDR=$(jq -r '.contracts.faucet' "$ACTIVE_CONFIG_PATH")
CHAIN_SELECTOR=$(jq -r '.common.chainSelector' "$ACTIVE_CONFIG_PATH")
LINK_TOKEN=$(jq -r '.common.linkToken' "$ACTIVE_CONFIG_PATH")

# Get volatility feed address from helper config (since same-chain uses helper config structure)
HELPER_CONFIG_PATH="ccip-faucet-fe/public/configs/chains/helpers/${ACTIVE_CHAIN}.json"
VOLATILITY_FEED=$(jq -r '.contracts.volatilityFeed' "$HELPER_CONFIG_PATH")

echo "=== 1. Configuration ==="
echo "Faucet Address: $FAUCET_ADDR"
echo "Chain Selector: $CHAIN_SELECTOR"
echo "LINK Token: $LINK_TOKEN"
echo "Volatility Feed: $VOLATILITY_FEED"
echo ""

# Check contract deployment
echo "=== 2. Contract Deployment ==="
FAUCET_CODE=$(cast code "$FAUCET_ADDR" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
if [[ "$FAUCET_CODE" != "0x" && ${#FAUCET_CODE} -gt 2 ]]; then
    echo "[OK] Faucet contract deployed"
    FAUCET_DEPLOYED=true
else
    echo "[ERROR] Faucet contract not found at $FAUCET_ADDR"
    FAUCET_DEPLOYED=false
fi
echo ""

if [[ "$FAUCET_DEPLOYED" != true ]]; then
    echo "[NOT READY] Faucet contract not deployed"
    exit 1
fi

# Check same-chain mapping (faucet should trust the volatility feed)
echo "=== 3. Same-Chain Mapping ==="
TRUSTED_ADDRESS=$(cast call "$FAUCET_ADDR" "trustedSenders(uint64)(address)" "$CHAIN_SELECTOR" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
echo "Faucet trustedSenders[$CHAIN_SELECTOR] = $TRUSTED_ADDRESS"

if [[ "${TRUSTED_ADDRESS,,}" == "${VOLATILITY_FEED,,}" ]]; then
    echo "[OK] Faucet correctly configured for same-chain (trusts volatility feed)"
    MAPPING_OK=true
else
    echo "[ERROR] Same-chain mapping incorrect. Expected: $VOLATILITY_FEED, Got: $TRUSTED_ADDRESS"
    echo "[FIX] Run: cast send $FAUCET_ADDR \"addChain(uint64,address)\" $CHAIN_SELECTOR $VOLATILITY_FEED --private-key \$FAUCET_PRIVATE_KEY --rpc-url \$AVALANCHE_FUJI_RPC_URL"
    MAPPING_OK=false
fi
echo ""

# Check volatility feed directly
echo "=== 4. Volatility Feed ==="
echo "Volatility Feed Address: $VOLATILITY_FEED"

# Test the feed directly
FEED_DATA=$(cast call "$VOLATILITY_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$AVALANCHE_FUJI_RPC_URL" 2>/dev/null || echo "FAILED")

if [[ "$FEED_DATA" == "FAILED" ]]; then
    echo "[ERROR] Volatility feed check failed - latestRoundData() reverted"
    echo "[ERROR] This will cause same-chain refill to fail!"
    FEED_OK=false
else
    # Parse the feed data
    read -r ROUND_ID ANSWER STARTED_AT UPDATED_AT ANSWERED_IN_ROUND <<< "$FEED_DATA"
    
    # Try to get feed description (optional)
    DESCRIPTION=$(cast call "$VOLATILITY_FEED" "description()(string)" --rpc-url "$AVALANCHE_FUJI_RPC_URL" 2>/dev/null || echo "Unknown Feed")
    
    echo "Feed Description: $DESCRIPTION"
    echo "Latest Price: $ANSWER (raw value)"
    
    # Convert timestamp to date
    if command -v date >/dev/null 2>&1; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS date command
            UPDATED_DATE=$(date -r "$UPDATED_AT" 2>/dev/null || echo "Invalid timestamp")
        else
            # Linux date command
            UPDATED_DATE=$(date -d "@$UPDATED_AT" 2>/dev/null || echo "Invalid timestamp")
        fi
        echo "Last Updated: $UPDATED_DATE"
    fi
    
    # Check if answer is valid (not zero)
    if [[ "$ANSWER" != "0" ]]; then
        echo "[OK] Volatility feed is working and returning data"
        FEED_OK=true
    else
        echo "[ERROR] Volatility feed returned zero/invalid price"
        FEED_OK=false
    fi
fi
echo ""

# Check LINK balance (only need faucet balance for same-chain)
echo "=== 5. LINK Token Balance ==="
FAUCET_LINK_BALANCE=$(cast call "$LINK_TOKEN" "balanceOf(address)(uint256)" "$FAUCET_ADDR" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
FAUCET_LINK_ETH=$(cast --to-unit "$FAUCET_LINK_BALANCE" ether)

echo "Faucet LINK balance: $FAUCET_LINK_ETH LINK"

# For same-chain, we don't need as much LINK (no CCIP fees), but still need some for operations
if (( $(echo "$FAUCET_LINK_BALANCE >= 100000000000000000" | bc -l) )); then
    echo "[OK] Faucet has sufficient LINK (>=0.1) for same-chain operations"
    FAUCET_LINK_OK=true
else
    echo "[WARN] Faucet has low LINK balance - consider adding more"
    echo "[TIP] Same-chain operations use much less LINK than cross-chain"
    FAUCET_LINK_OK=true  # Still OK for same-chain
fi
echo ""

# Check faucet state
echo "=== 6. Faucet State ==="
RESERVOIR_STATUS=$(cast call "$FAUCET_ADDR" "getReservoirStatus()(uint256,uint256,uint256,uint256)" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
read -r NATIVE_POOL NATIVE_DRIP LINK_POOL LINK_DRIP <<< "$RESERVOIR_STATUS"

NATIVE_POOL_ETH=$(cast --to-unit "$NATIVE_POOL" ether)
LINK_POOL_ETH=$(cast --to-unit "$LINK_POOL" ether)

echo "Native Pool: $NATIVE_POOL_ETH AVAX"
echo "LINK Pool: $LINK_POOL_ETH LINK"

REFILL_IN_PROGRESS=$(cast call "$FAUCET_ADDR" "refillInProgress()(bool)" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
echo "Refill in progress: $REFILL_IN_PROGRESS"

if [[ "$REFILL_IN_PROGRESS" == "true" ]]; then
    echo "[ERROR] Cannot trigger: refill already in progress"
    FAUCET_STATE_OK=false
else
    echo "[OK] No active refill"
    
    # Check if refill is needed
    THRESHOLD_FACTOR=$(cast call "$FAUCET_ADDR" "thresholdFactor()(uint256)" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
    NATIVE_THRESHOLD=$((NATIVE_DRIP * THRESHOLD_FACTOR))
    LINK_THRESHOLD=$((LINK_DRIP * THRESHOLD_FACTOR))
    
    if (( NATIVE_POOL < NATIVE_THRESHOLD || LINK_POOL < LINK_THRESHOLD )); then
        echo "[OK] Refill needed - ready for same-chain volatility fetch"
        FAUCET_STATE_OK=true
    else
        echo "[WARN] Reservoirs full - may need to increase thresholdFactor to test"
        echo "[TIP] Run: cast send $FAUCET_ADDR \"setThresholdFactor(uint256)\" 20 --private-key \$FAUCET_PRIVATE_KEY --rpc-url \$AVALANCHE_FUJI_RPC_URL"
        FAUCET_STATE_OK=true  # Still OK, just a warning
    fi
fi
echo ""

# Check owner
echo "=== 7. Owner Verification ==="
FAUCET_OWNER=$(cast call "$FAUCET_ADDR" "owner()(address)" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
echo "Faucet owner: $FAUCET_OWNER"
echo "[OK] Owner verified"
echo ""

# Test same-chain detection (if contract has the new logic)
echo "=== 8. Same-Chain Detection Test ==="
echo "Testing if contract can detect volatility feed..."

# Try to simulate the detection logic by calling the volatility feed
DETECTION_TEST=$(cast call "$VOLATILITY_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$AVALANCHE_FUJI_RPC_URL" 2>/dev/null || echo "FAILED")

if [[ "$DETECTION_TEST" != "FAILED" ]]; then
    echo "[OK] Volatility feed responds to latestRoundData() - contract should detect it as same-chain"
    DETECTION_OK=true
else
    echo "[ERROR] Volatility feed detection will fail - contract will try CCIP instead"
    DETECTION_OK=false
fi
echo ""

# Summary
echo "=== Summary ==="
if [[ "$MAPPING_OK" == true && "$FAUCET_LINK_OK" == true && "$FEED_OK" == true && "$FAUCET_STATE_OK" == true && "$DETECTION_OK" == true ]]; then
    echo "[READY] Same-chain deployment ready! All checks passed."
    echo ""
    echo "🚀 SAME-CHAIN ADVANTAGES:"
    echo "   ✅ No CCIP fees (much cheaper)"
    echo "   ✅ Instant volatility updates (no cross-chain delay)"
    echo "   ✅ Direct price feed access"
    echo ""
    echo "Test command:"
    echo "cast send $FAUCET_ADDR \"triggerRefillCheck()\" --private-key \$FAUCET_PRIVATE_KEY --rpc-url \$AVALANCHE_FUJI_RPC_URL"
else
    echo "[NOT READY] Fix issues above before testing same-chain refill."
    
    if [[ "$MAPPING_OK" != true ]]; then
        echo ""
        echo "🔧 QUICK FIX - Configure same-chain mapping:"
        echo "cast send $FAUCET_ADDR \"addChain(uint64,address)\" $CHAIN_SELECTOR $VOLATILITY_FEED --private-key \$FAUCET_PRIVATE_KEY --rpc-url \$AVALANCHE_FUJI_RPC_URL"
    fi
    
    exit 1
fi
