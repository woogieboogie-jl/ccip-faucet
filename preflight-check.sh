#!/bin/bash

# CCIP Pre-Flight Checks - Shell Script Version
# Usage: ./preflight-check.sh

set -e

ACTIVE_CHAIN=${CHAIN_NAME:-monad-testnet}
HELPER_CHAIN=${HELPER_NAME:-avalanche-fuji}

echo "=== CCIP Pre-Flight Checks ==="
echo "Active Chain: $ACTIVE_CHAIN"
echo "Helper Chain: $HELPER_CHAIN"
echo ""

# Check environment variables
if [[ -z "$MONAD_TESTNET_RPC_URL" ]]; then
    echo "[ERROR] MONAD_TESTNET_RPC_URL not set"
    exit 1
fi

if [[ -z "$AVALANCHE_FUJI_RPC_URL" ]]; then
    echo "[ERROR] AVALANCHE_FUJI_RPC_URL not set"
    exit 1
fi

# Read configurations
ACTIVE_CONFIG_PATH="ccip-faucet-fe/public/configs/chains/${ACTIVE_CHAIN}.json"
HELPER_CONFIG_PATH="ccip-faucet-fe/public/configs/chains/helpers/${HELPER_CHAIN}.json"

if [[ ! -f "$ACTIVE_CONFIG_PATH" ]]; then
    echo "[ERROR] Active chain config not found: $ACTIVE_CONFIG_PATH"
    exit 1
fi

if [[ ! -f "$HELPER_CONFIG_PATH" ]]; then
    echo "[ERROR] Helper chain config not found: $HELPER_CONFIG_PATH"
    exit 1
fi

# Extract addresses and selectors using jq
FAUCET_ADDR=$(jq -r '.contracts.faucet' "$ACTIVE_CONFIG_PATH")
HELPER_ADDR=$(jq -r '.contracts.helper' "$HELPER_CONFIG_PATH")
ACTIVE_SELECTOR=$(jq -r '.common.chainSelector' "$ACTIVE_CONFIG_PATH")
HELPER_SELECTOR=$(jq -r '.common.chainSelector' "$HELPER_CONFIG_PATH")
ACTIVE_LINK=$(jq -r '.common.linkToken' "$ACTIVE_CONFIG_PATH")
HELPER_LINK=$(jq -r '.common.linkToken' "$HELPER_CONFIG_PATH")

echo "=== 1. Contract Addresses ==="
echo "Faucet Address: $FAUCET_ADDR"
echo "Helper Address: $HELPER_ADDR"
echo "Active Selector: $ACTIVE_SELECTOR"
echo "Helper Selector: $HELPER_SELECTOR"
echo ""

# Check contract deployments
echo "=== 2. Contract Deployments ==="
FAUCET_CODE=$(cast code "$FAUCET_ADDR" --rpc-url "$MONAD_TESTNET_RPC_URL")
if [[ "$FAUCET_CODE" != "0x" && ${#FAUCET_CODE} -gt 2 ]]; then
    echo "[OK] Faucet contract deployed"
    FAUCET_DEPLOYED=true
else
    echo "[ERROR] Faucet contract not found at $FAUCET_ADDR"
    FAUCET_DEPLOYED=false
fi

HELPER_CODE=$(cast code "$HELPER_ADDR" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
if [[ "$HELPER_CODE" != "0x" && ${#HELPER_CODE} -gt 2 ]]; then
    echo "[OK] Helper contract deployed"
    HELPER_DEPLOYED=true
else
    echo "[ERROR] Helper contract not found at $HELPER_ADDR"
    HELPER_DEPLOYED=false
fi
echo ""

if [[ "$FAUCET_DEPLOYED" != true || "$HELPER_DEPLOYED" != true ]]; then
    echo "[NOT READY] Contracts not deployed properly"
    exit 1
fi

# Check cross-chain mappings
echo "=== 3. Cross-Chain Mappings ==="
TRUSTED_HELPER=$(cast call "$FAUCET_ADDR" "trustedSenders(uint64)(address)" "$HELPER_SELECTOR" --rpc-url "$MONAD_TESTNET_RPC_URL")
echo "Faucet trustedSenders[$HELPER_SELECTOR] = $TRUSTED_HELPER"

if [[ "${TRUSTED_HELPER,,}" == "${HELPER_ADDR,,}" ]]; then
    echo "[OK] Faucet correctly trusts helper"
    FAUCET_MAPPING_OK=true
else
    echo "[ERROR] Faucet mapping incorrect. Expected: $HELPER_ADDR, Got: $TRUSTED_HELPER"
    FAUCET_MAPPING_OK=false
fi

TRUSTED_FAUCET=$(cast call "$HELPER_ADDR" "selectorToFaucet(uint64)(address)" "$ACTIVE_SELECTOR" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
echo "Helper selectorToFaucet[$ACTIVE_SELECTOR] = $TRUSTED_FAUCET"

if [[ "${TRUSTED_FAUCET,,}" == "${FAUCET_ADDR,,}" ]]; then
    echo "[OK] Helper correctly trusts faucet"
    HELPER_MAPPING_OK=true
else
    echo "[ERROR] Helper mapping incorrect. Expected: $FAUCET_ADDR, Got: $TRUSTED_FAUCET"
    HELPER_MAPPING_OK=false
fi
echo ""

# Check volatility feed
echo "=== 4. Volatility Feed ==="
VOLATILITY_FEED=$(cast call "$HELPER_ADDR" "volatilityFeed()(address)" --rpc-url "$AVALANCHE_FUJI_RPC_URL")
echo "Volatility Feed Address: $VOLATILITY_FEED"

# Test the feed
FEED_DATA=$(cast call "$VOLATILITY_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$AVALANCHE_FUJI_RPC_URL" 2>/dev/null || echo "FAILED")

if [[ "$FEED_DATA" == "FAILED" ]]; then
    echo "[ERROR] Volatility feed check failed - latestRoundData() reverted"
    echo "[ERROR] This will cause CCIP message execution to revert!"
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

# Check LINK balances
echo "=== 5. LINK Token Balances ==="
FAUCET_LINK_BALANCE=$(cast call "$ACTIVE_LINK" "balanceOf(address)(uint256)" "$FAUCET_ADDR" --rpc-url "$MONAD_TESTNET_RPC_URL")
HELPER_LINK_BALANCE=$(cast call "$HELPER_LINK" "balanceOf(address)(uint256)" "$HELPER_ADDR" --rpc-url "$AVALANCHE_FUJI_RPC_URL")

FAUCET_LINK_ETH=$(cast --to-unit "$FAUCET_LINK_BALANCE" ether)
HELPER_LINK_ETH=$(cast --to-unit "$HELPER_LINK_BALANCE" ether)

echo "Faucet LINK balance: $FAUCET_LINK_ETH LINK"
echo "Helper LINK balance: $HELPER_LINK_ETH LINK"

# Check if balances are >= 1 LINK (1e18)
if (( $(echo "$FAUCET_LINK_BALANCE >= 1000000000000000000" | bc -l) )); then
    echo "[OK] Faucet has sufficient LINK (>=1)"
    FAUCET_LINK_OK=true
else
    echo "[ERROR] Faucet needs more LINK for outbound fees"
    FAUCET_LINK_OK=false
fi

if (( $(echo "$HELPER_LINK_BALANCE >= 1000000000000000000" | bc -l) )); then
    echo "[OK] Helper has sufficient LINK (>=1)"
    HELPER_LINK_OK=true
else
    echo "[ERROR] Helper needs more LINK for reply fees"
    HELPER_LINK_OK=false
fi
echo ""

# Check faucet state
echo "=== 6. Faucet State ==="
RESERVOIR_STATUS=$(cast call "$FAUCET_ADDR" "getReservoirStatus()(uint256,uint256,uint256,uint256)" --rpc-url "$MONAD_TESTNET_RPC_URL")
read -r NATIVE_POOL NATIVE_DRIP LINK_POOL LINK_DRIP <<< "$RESERVOIR_STATUS"

NATIVE_POOL_ETH=$(cast --to-unit "$NATIVE_POOL" ether)
LINK_POOL_ETH=$(cast --to-unit "$LINK_POOL" ether)

echo "Native Pool: $NATIVE_POOL_ETH tokens"
echo "LINK Pool: $LINK_POOL_ETH LINK"

REFILL_IN_PROGRESS=$(cast call "$FAUCET_ADDR" "refillInProgress()(bool)" --rpc-url "$MONAD_TESTNET_RPC_URL")
echo "Refill in progress: $REFILL_IN_PROGRESS"

if [[ "$REFILL_IN_PROGRESS" == "true" ]]; then
    echo "[ERROR] Cannot trigger: refill already in progress"
    FAUCET_STATE_OK=false
else
    echo "[OK] No active refill"
    
    # Check if refill is needed
    THRESHOLD_FACTOR=$(cast call "$FAUCET_ADDR" "thresholdFactor()(uint256)" --rpc-url "$MONAD_TESTNET_RPC_URL")
    NATIVE_THRESHOLD=$((NATIVE_DRIP * THRESHOLD_FACTOR))
    LINK_THRESHOLD=$((LINK_DRIP * THRESHOLD_FACTOR))
    
    if (( NATIVE_POOL < NATIVE_THRESHOLD || LINK_POOL < LINK_THRESHOLD )); then
        echo "[OK] Refill needed"
        FAUCET_STATE_OK=true
    else
        echo "[WARN] Reservoirs full - may need to increase thresholdFactor"
        echo "[TIP] Run: cast send $FAUCET_ADDR \"setThresholdFactor(uint256)\" 20 --private-key \$FAUCET_PRIVATE_KEY --rpc-url \$MONAD_TESTNET_RPC_URL"
        FAUCET_STATE_OK=true  # Still OK, just a warning
    fi
fi
echo ""

# Check owners
echo "=== 7. Owner Verification ==="
FAUCET_OWNER=$(cast call "$FAUCET_ADDR" "owner()(address)" --rpc-url "$MONAD_TESTNET_RPC_URL")
HELPER_OWNER=$(cast call "$HELPER_ADDR" "owner()(address)" --rpc-url "$AVALANCHE_FUJI_RPC_URL")

echo "Faucet owner: $FAUCET_OWNER"
echo "Helper owner: $HELPER_OWNER"

if [[ "${FAUCET_OWNER,,}" == "${HELPER_OWNER,,}" ]]; then
    echo "[OK] Same owner for both contracts"
else
    echo "[WARN] Different owners - ensure coordination"
fi
echo ""

# Summary
echo "=== Summary ==="
if [[ "$FAUCET_MAPPING_OK" == true && "$HELPER_MAPPING_OK" == true && "$FAUCET_LINK_OK" == true && "$HELPER_LINK_OK" == true && "$FEED_OK" == true && "$FAUCET_STATE_OK" == true ]]; then
    echo "[READY] CCIP ready! All checks passed."
    echo "Run: cast send $FAUCET_ADDR \"triggerRefillCheck()\" --private-key \$FAUCET_PRIVATE_KEY --rpc-url \$MONAD_TESTNET_RPC_URL"
else
    echo "[NOT READY] Fix issues above before triggering CCIP."
    exit 1
fi
