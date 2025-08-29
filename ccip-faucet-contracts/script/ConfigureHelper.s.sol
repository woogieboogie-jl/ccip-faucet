// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {VolatilityHelper} from "../src/VolatilityHelper.sol";

/// @notice JSON-driven: whitelist an active chain + faucet on the helper
/// Env:
///  - CHAIN_NAME (active)
///  - HELPER_NAME (helper)
///  - FAUCET_PRIVATE_KEY
contract ConfigureHelper is Script {
    function run() external {
        string memory chainName = vm.envString("CHAIN_NAME");
        string memory helperName = vm.envString("HELPER_NAME");
        uint256 pk = vm.envUint("FAUCET_PRIVATE_KEY");

        // Active chain config
        string memory activePath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/",
            chainName,
            ".json"
        );
        string memory activeJson = vm.readFile(activePath);

        if (!vm.keyExists(activeJson, "$.common.chainSelector")) revert("Active config missing: common.chainSelector");
        if (!vm.keyExists(activeJson, "$.contracts.faucet")) revert("Active config missing: contracts.faucet");

        uint64 selector = uint64(vm.parseJsonUint(activeJson, "$.common.chainSelector"));
        address faucetAddr = vm.parseJsonAddress(activeJson, "$.contracts.faucet");

        // Helper chain config
        string memory helperPath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/helpers/",
            helperName,
            ".json"
        );
        string memory helperJson = vm.readFile(helperPath);
        if (!vm.keyExists(helperJson, "$.contracts.helper")) revert("Helper config missing: contracts.helper");
        address payable helperAddr = payable(vm.parseJsonAddress(helperJson, "$.contracts.helper"));

        vm.startBroadcast(pk);
        VolatilityHelper(helperAddr).addSource(selector, faucetAddr);
        vm.stopBroadcast();

        console2.log("Helper configured. selector:", selector);
        console2.log("Faucet:", faucetAddr);
        console2.log("Helper:", helperAddr);
    }
}


