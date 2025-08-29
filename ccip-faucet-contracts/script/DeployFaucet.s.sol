// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Faucet} from "../src/Faucet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys Faucet.sol on any configured chain
contract DeployFaucet is Script {
    function run() external {
        // Validate required environment variables
        string memory chainName = vm.envString("CHAIN_NAME");
        string memory helperName;
        try vm.envString("HELPER_NAME") returns (string memory s) { helperName = s; } catch { helperName = ""; }
        uint256 pk = vm.envUint("FAUCET_PRIVATE_KEY");
        
        // Optional parameters with defaults
        uint256 initialFund;
        try vm.envUint("INITIAL_FUND") returns (uint256 v) { initialFund = v; } catch { initialFund = 1 ether; }
        // No env overrides for addresses; addresses come from JSON configs
        
        // Active chain config
        string memory activePath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/",
            chainName,
            ".json"
        );
        string memory activeJson = vm.readFile(activePath);
        
        // Validate required JSON fields exist
        if (!vm.keyExists(activeJson, "$.common.ccipRouter")) {
            revert("Config missing: common.ccipRouter");
        }
        if (!vm.keyExists(activeJson, "$.common.linkToken")) {
            revert("Config missing: common.linkToken");
        }
        
        // Parse active chain's values with error handling
        address activeChainRouter;
        address linkToken;
        
        try vm.parseJsonAddress(activeJson, "$.common.ccipRouter") returns (address routerAddr) {
            activeChainRouter = routerAddr;
        } catch {
            revert("Failed to parse common.ccipRouter");
        }
        
        try vm.parseJsonAddress(activeJson, "$.common.linkToken") returns (address linkAddr) {
            linkToken = linkAddr;
        } catch {
            revert("Failed to parse common.linkToken");
        }

        // Resolve helper name from active config if not provided
        if (bytes(helperName).length == 0) {
            helperName = vm.parseJsonString(activeJson, "$.ccip.helperChain");
        }

        // Helper chain config
        string memory helperPath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/helpers/",
            helperName,
            ".json"
        );
        string memory helperJson = vm.readFile(helperPath);

        if (!vm.keyExists(helperJson, "$.common.chainSelector")) {
            revert("Helper config missing: common.chainSelector");
        }

        uint64 helperSelector;
        try vm.parseJsonUint(helperJson, "$.common.chainSelector") returns (uint256 sel) {
            helperSelector = uint64(sel);
        } catch {
            revert("Failed to parse helper.common.chainSelector");
        }

        // Helper address will be configured later via ConfigureFaucet
        vm.startBroadcast(pk);
 
        // Deploy faucet with correct parameters (helper configured separately)
        Faucet faucet = new Faucet{value: initialFund}(
            activeChainRouter,        // Router on active chain
            helperSelector,           // Helper chain selector from config
            address(0),               // Helper will be set via addChain() later
            linkToken,                // LINK token on active chain
            0.5 ether,               // initial native drip
            5 ether                  // initial LINK drip
        );
 
        vm.stopBroadcast();
 
        console2.log("=== Deployment Summary ===");
        console2.log("Chain:", chainName);
        console2.log("Active Chain Router:", activeChainRouter);
        console2.log("Helper Chain:", helperName);
        console2.log("Helper Chain Selector:", helperSelector);
        console2.log("LINK Token:", linkToken);
        console2.log("Initial Fund:", initialFund);
        console2.log("Faucet deployed at:", address(faucet));
        console2.log("");
        console2.log("=== Next Steps ===");
        console2.log("1. Update configs (source of truth):");
        console2.log("   - ccip-faucet-fe/public/configs/chains/", chainName, ".json -> contracts.faucet=", address(faucet));
        console2.log("   - ccip-faucet-fe/public/configs/chains/helpers/", helperName, ".json -> contracts.helper=<DEPLOYED_HELPER_ADDRESS>");
        console2.log("2. Deploy helper, then run ConfigureFaucet to whitelist helper on faucet");
    }
}
 
