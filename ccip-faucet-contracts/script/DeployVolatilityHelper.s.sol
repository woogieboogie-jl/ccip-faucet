// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {VolatilityHelper} from "../src/VolatilityHelper.sol";

/// @notice JSON-driven deployer for VolatilityHelper.
/// Reads active-chain and helper-chain configs from FE-owned configs; no .env addresses.
contract DeployVolatilityHelper is Script {
    function run() external {
        // Required env
        string memory chainName = vm.envString("CHAIN_NAME");          // active chain (e.g., monad-testnet)
        string memory helperName;                                       // helper chain (e.g., avalanche-fuji)
        try vm.envString("HELPER_NAME") returns (string memory s) { helperName = s; } catch { helperName = ""; }
        uint256 pk = vm.envUint("FAUCET_PRIVATE_KEY");                 // deployer key on helper chain

        // Helper chain config
        string memory helperPath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/helpers/",
            helperName,
            ".json"
        );
        string memory helperJson = vm.readFile(helperPath);

        // Required helper fields
        if (!vm.keyExists(helperJson, "$.common.ccipRouter")) revert("Helper config missing: common.ccipRouter");
        if (!vm.keyExists(helperJson, "$.common.linkToken")) revert("Helper config missing: common.linkToken");

        // Optional but recommended: contracts.volatilityFeed in helper JSON
        if (!vm.keyExists(helperJson, "$.contracts.volatilityFeed")) revert("Helper config missing: contracts.volatilityFeed");

        address helperRouter = vm.parseJsonAddress(helperJson, "$.common.ccipRouter");
        address helperLink   = vm.parseJsonAddress(helperJson, "$.common.linkToken");
        address volFeed      = vm.parseJsonAddress(helperJson, "$.contracts.volatilityFeed");

        vm.startBroadcast(pk);
        VolatilityHelper helper = new VolatilityHelper(
            helperRouter,
            volFeed,
            helperLink
        );
        vm.stopBroadcast();

        console2.log("=== VolatilityHelper Deployment ===");
        console2.log("Active Chain:", chainName);
        console2.log("Helper Chain:", helperName);
        console2.log("Helper Router:", helperRouter);
        console2.log("Helper LINK:", helperLink);
        console2.log("Volatility Feed:", volFeed);
        console2.log("VolatilityHelper deployed at:", address(helper));
        console2.log("");
        console2.log("=== Next Steps ===");
        console2.log(
            string.concat(
                "Run ConfigureHelper per active chain to whitelist faucet(s):\n",
                "CHAIN_NAME=", chainName,
                " HELPER_NAME=", helperName,
                " forge script script/ConfigureHelper.s.sol:ConfigureHelper --rpc-url $AVALANCHE_FUJI_RPC_URL --broadcast"
            )
        );
        console2.log("");
        console2.log("=== Next Steps ===");
        console2.log("1. Update configs (source of truth):");
        console2.log("   - ccip-faucet-fe/public/configs/chains/helpers/", helperName, ".json -> contracts.helper=", address(helper));
        console2.log("2. Map helper to faucet (JSON-driven ConfigureFaucet script)");
        console2.log(
            string.concat(
                "   CHAIN_NAME=", chainName,
                " HELPER_NAME=", helperName,
                " forge script script/ConfigureFaucet.s.sol:ConfigureFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast"
                )
            );
        console2.log("3. Ensure sufficient LINK on helper chain if reply fees are paid by helper");
    }
}
 
