// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Faucet} from "../src/Faucet.sol";

/// @notice JSON-driven faucet configurator. Maps helper chain to the faucet using configs.
/// Inputs:
///  - CHAIN_NAME (required): active chain config name (e.g., monad-testnet)
///  - HELPER_NAME (optional): helper chain config name (e.g., avalanche-fuji). If omitted, read from active config `ccip.helperChain`.
///  - FAUCET_PRIVATE_KEY (required): owner key to call addChain on faucet.
///  - Addresses are read from JSON configs only (no env overrides).
contract ConfigureFaucet is Script {
    function run() external {
        string memory chainName = vm.envString("CHAIN_NAME");
        string memory helperName;
        try vm.envString("HELPER_NAME") returns (string memory s) { helperName = s; } catch { helperName = ""; }

        uint256 pk = vm.envUint("FAUCET_PRIVATE_KEY");

        // Active chain config (for faucet address and default helper name)
        string memory activePath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/",
            chainName,
            ".json"
        );
        string memory activeJson = vm.readFile(activePath);

        if (!vm.keyExists(activeJson, "$.contracts.faucet")) revert("Active config missing: contracts.faucet");
        address payable faucetAddr = payable(vm.parseJsonAddress(activeJson, "$.contracts.faucet"));

        if (bytes(helperName).length == 0) {
            helperName = vm.parseJsonString(activeJson, "$.ccip.helperChain");
        }

        // Helper chain config (for helper selector and address)
        string memory helperPath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/helpers/",
            helperName,
            ".json"
        );
        string memory helperJson = vm.readFile(helperPath);

        if (!vm.keyExists(helperJson, "$.common.chainSelector")) revert("Helper config missing: common.chainSelector");
        uint64 helperSelector;
        try vm.parseJsonUint(helperJson, "$.common.chainSelector") returns (uint256 sel) { helperSelector = uint64(sel); } catch {
            revert("Failed to parse helper.common.chainSelector");
        }

        if (!vm.keyExists(helperJson, "$.contracts.helper")) revert("Helper config missing: contracts.helper");
        address helperAddr = vm.parseJsonAddress(helperJson, "$.contracts.helper");

        vm.startBroadcast(pk);
        Faucet(faucetAddr).addChain(helperSelector, helperAddr);
        vm.stopBroadcast();

        console2.log("=== Faucet Configuration ===");
        console2.log("Active Chain:", chainName);
        console2.log("Helper Chain:", helperName);
        console2.log("Faucet:", faucetAddr);
        console2.log("Helper Selector:", helperSelector);
        console2.log("Helper Address:", helperAddr);
    }
}
 