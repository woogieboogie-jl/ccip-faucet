// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

/// @notice Test script to verify JSON config parsing
contract TestConfig is Script {
    function run() external view {
        string memory chainName = vm.envString("CHAIN_NAME");
        string memory helperName;
        try vm.envString("HELPER_NAME") returns (string memory s) { helperName = s; } catch { helperName = ""; }
        
        console2.log("=== Testing Active Chain:", chainName);
        
        // Active chain config
        string memory activePath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/",
            chainName,
            ".json"
        );
        string memory activeJson = vm.readFile(activePath);
        console2.log("Active path:", activePath);
        
        address activeRouter = vm.parseJsonAddress(activeJson, "$.common.ccipRouter");
        address activeLink   = vm.parseJsonAddress(activeJson, "$.common.linkToken");
        string memory activeSelector = vm.parseJsonString(activeJson, "$.common.chainSelector");
        console2.log("[OK] Active Router:", activeRouter);
        console2.log("[OK] Active LINK:", activeLink);
        console2.log("[OK] Active Selector:", activeSelector);
        
        // Resolve helper name if not provided
        if (bytes(helperName).length == 0) {
            helperName = vm.parseJsonString(activeJson, "$.ccip.helperChain");
            console2.log("[OK] Helper resolved from active config:", helperName);
        }
        
        // Helper chain config
        string memory helperPath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/helpers/",
            helperName,
            ".json"
        );
        string memory helperJson = vm.readFile(helperPath);
        console2.log("Helper path:", helperPath);
        
        address helperRouter = vm.parseJsonAddress(helperJson, "$.common.ccipRouter");
        address helperLink   = vm.parseJsonAddress(helperJson, "$.common.linkToken");
        string memory helperSelector = vm.parseJsonString(helperJson, "$.common.chainSelector");
        console2.log("[OK] Helper Router:", helperRouter);
        console2.log("[OK] Helper LINK:", helperLink);
        console2.log("[OK] Helper Selector:", helperSelector);
        
        console2.log("=== Configs parsed successfully (active + helper)! ===");
    }
}
