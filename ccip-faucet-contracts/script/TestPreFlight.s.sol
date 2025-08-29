// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Faucet} from "../src/Faucet.sol";
import {VolatilityHelper} from "../src/VolatilityHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Pre-flight checks for CCIP deployment
/// Tests all conditions before triggering CCIP messages
/// Env:
///  - CHAIN_NAME (active chain config)
///  - HELPER_NAME (helper chain config)
contract TestPreFlight is Script {
    function run() external view {
        string memory chainName = vm.envString("CHAIN_NAME");
        string memory helperName = vm.envString("HELPER_NAME");

        console2.log("=== CCIP Pre-Flight Checks ===");
        console2.log("Active Chain:", chainName);
        console2.log("Helper Chain:", helperName);
        console2.log("");

        _runChecks(chainName, helperName);
    }

    function _runChecks(string memory chainName, string memory helperName) internal view {
        // Read configs
        (
            address faucetAddr,
            address helperAddr,
            uint64 activeSelector,
            uint64 helperSelector,
            address activeLinkToken,
            address helperLinkToken
        ) = _readConfigs(chainName, helperName);

        console2.log("=== 1. Contract Addresses ===");
        console2.log("Faucet Address:", faucetAddr);
        console2.log("Helper Address:", helperAddr);
        console2.log("Active Selector:", activeSelector);
        console2.log("Helper Selector:", helperSelector);
        console2.log("");

        // Check contracts exist
        _checkContractExists("Faucet", faucetAddr);
        _checkContractExists("Helper", helperAddr);

        // Check mappings
        bool mappingsOk = _checkMappings(faucetAddr, helperAddr, activeSelector, helperSelector);
        
        // Check LINK balances
        bool linkOk = _checkLinkBalances(faucetAddr, helperAddr, activeLinkToken, helperLinkToken);
        
        // Check faucet state
        bool stateOk = _checkFaucetState(faucetAddr);
        
        // Check owners
        _checkOwners(faucetAddr, helperAddr);

        console2.log("=== Summary ===");
        if (mappingsOk && linkOk && stateOk) {
            console2.log("[READY] CCIP ready! All checks passed.");
            console2.log("Run: cast send", faucetAddr, '"triggerRefillCheck()" --private-key $FAUCET_PRIVATE_KEY --rpc-url $RPC_URL');
        } else {
            console2.log("[NOT READY] Fix issues above before triggering CCIP.");
        }
    }

    function _checkMappings(address faucetAddr, address helperAddr, uint64 activeSelector, uint64 helperSelector) 
        internal view returns (bool) {
        console2.log("=== 2. Cross-Chain Mappings ===");
        
        // Check faucet → helper mapping
        address trustedHelper = Faucet(payable(faucetAddr)).trustedSenders(helperSelector);
        console2.log("Faucet trustedSenders[", helperSelector, "] =", trustedHelper);
        bool faucetOk = trustedHelper == helperAddr;
        if (faucetOk) {
            console2.log("[OK] Faucet correctly trusts helper");
        } else {
            console2.log("[ERROR] Faucet mapping incorrect");
        }

        // Check helper → faucet mapping
        address trustedFaucet = VolatilityHelper(payable(helperAddr)).selectorToFaucet(activeSelector);
        console2.log("Helper selectorToFaucet[", activeSelector, "] =", trustedFaucet);
        bool helperOk = trustedFaucet == faucetAddr;
        if (helperOk) {
            console2.log("[OK] Helper correctly trusts faucet");
        } else {
            console2.log("[ERROR] Helper mapping incorrect");
        }
        console2.log("");
        return faucetOk && helperOk;
    }

    function _checkLinkBalances(address faucetAddr, address helperAddr, address activeLinkToken, address helperLinkToken) 
        internal view returns (bool) {
        console2.log("=== 3. LINK Token Balances ===");
        
        uint256 faucetBalance = IERC20(activeLinkToken).balanceOf(faucetAddr);
        uint256 helperBalance = IERC20(helperLinkToken).balanceOf(helperAddr);
        
        console2.log("Faucet LINK balance:", faucetBalance / 1e18, "LINK");
        console2.log("Helper LINK balance:", helperBalance / 1e18, "LINK");
        
        bool faucetOk = faucetBalance >= 1e18;
        bool helperOk = helperBalance >= 1e18;
        
        if (faucetOk) {
            console2.log("[OK] Faucet has sufficient LINK");
        } else {
            console2.log("[ERROR] Faucet needs more LINK");
        }
        
        if (helperOk) {
            console2.log("[OK] Helper has sufficient LINK");
        } else {
            console2.log("[ERROR] Helper needs more LINK");
        }
        console2.log("");
        return faucetOk && helperOk;
    }

    function _checkFaucetState(address faucetAddr) internal view returns (bool) {
        console2.log("=== 4. Faucet State ===");
        
        (uint256 nativePool, uint256 nativeDripRate, uint256 linkPool, uint256 linkDripRate) = 
            Faucet(payable(faucetAddr)).getReservoirStatus();
        
        console2.log("Native Pool:", nativePool / 1e18, "tokens");
        console2.log("LINK Pool:", linkPool / 1e18, "LINK");
        
        bool refillInProgress = Faucet(payable(faucetAddr)).refillInProgress();
        console2.log("Refill in progress:", refillInProgress);
        
        if (refillInProgress) {
            console2.log("[ERROR] Cannot trigger: refill in progress");
            console2.log("");
            return false;
        } else {
            console2.log("[OK] No active refill");
        }

        uint256 thresholdFactor = Faucet(payable(faucetAddr)).thresholdFactor();
        bool needsRefill = (nativePool < nativeDripRate * thresholdFactor) || (linkPool < linkDripRate * thresholdFactor);
        
        if (needsRefill) {
            console2.log("[OK] Refill needed");
        } else {
            console2.log("[WARN] May need higher thresholdFactor to trigger");
        }
        console2.log("");
        return needsRefill;
    }

    function _checkOwners(address faucetAddr, address helperAddr) internal view {
        console2.log("=== 5. Owner Verification ===");
        console2.log("Owners match:", Faucet(payable(faucetAddr)).owner() == VolatilityHelper(payable(helperAddr)).owner());
        console2.log("");
    }

    function _readConfigs(string memory chainName, string memory helperName) 
        internal 
        view 
        returns (
            address faucetAddr,
            address helperAddr,
            uint64 activeSelector,
            uint64 helperSelector,
            address activeLinkToken,
            address helperLinkToken
        ) 
    {
        // Active chain config
        string memory activePath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/",
            chainName,
            ".json"
        );
        string memory activeJson = vm.readFile(activePath);

        faucetAddr = vm.parseJsonAddress(activeJson, "$.contracts.faucet");
        activeSelector = uint64(vm.parseJsonUint(activeJson, "$.common.chainSelector"));
        activeLinkToken = vm.parseJsonAddress(activeJson, "$.common.linkToken");

        // Helper chain config
        string memory helperPath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/helpers/",
            helperName,
            ".json"
        );
        string memory helperJson = vm.readFile(helperPath);

        helperAddr = vm.parseJsonAddress(helperJson, "$.contracts.helper");
        helperSelector = uint64(vm.parseJsonUint(helperJson, "$.common.chainSelector"));
        helperLinkToken = vm.parseJsonAddress(helperJson, "$.common.linkToken");
    }

    function _checkContractExists(string memory name, address addr) internal view {
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(addr)
        }
        
        if (codeSize > 0) {
            console2.log("[OK]", name, "contract deployed");
        } else {
            console2.log("[ERROR]", name, "contract not found at", addr);
        }
    }
}
