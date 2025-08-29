// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice JSON-driven funding script for Faucet (active chain) and VolatilityHelper (helper chain)
/// Inputs (env):
///  - CHAIN_NAME (required): active chain config name (e.g., monad-testnet)
///  - HELPER_NAME (optional): helper chain config name (e.g., avalanche-fuji). If omitted, resolved from active config
///  - TARGET (optional): "active" | "helper" (default: "active")
///  - AMOUNT (optional): amount of LINK (wei) to send (default: 1e18)
///  - FAUCET_PRIVATE_KEY (required): funding key (must hold LINK on the selected chain)
///
/// Usage examples:
///  - Fund Faucet (active chain):
///    CHAIN_NAME=monad-testnet TARGET=active AMOUNT=1000000000000000000 forge script script/FundContracts.s.sol:FundContracts --rpc-url $MONAD_TESTNET_RPC_URL --broadcast
///  - Fund Helper (helper chain):
///    CHAIN_NAME=monad-testnet HELPER_NAME=avalanche-fuji TARGET=helper AMOUNT=1000000000000000000 forge script script/FundContracts.s.sol:FundContracts --rpc-url $AVALANCHE_FUJI_RPC_URL --broadcast
contract FundContracts is Script {
    function run() external {
        uint256 pk = vm.envUint("FAUCET_PRIVATE_KEY");
        string memory chainName = vm.envString("CHAIN_NAME");
        string memory helperName; try vm.envString("HELPER_NAME") returns (string memory s) { helperName = s; } catch { helperName = ""; }
        string memory target; try vm.envString("TARGET") returns (string memory t) { target = t; } catch { target = "active"; }
        uint256 amount; try vm.envUint("AMOUNT") returns (uint256 a) { amount = a; } catch { amount = 1 ether; }

        // Active chain config
        string memory activePath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/",
            chainName,
            ".json"
        );
        string memory activeJson = vm.readFile(activePath);

        // Resolve helper name if not provided
        if (bytes(helperName).length == 0) {
            helperName = vm.parseJsonString(activeJson, "$.ccip.helperChain");
        }

        // Parse active addresses
        address activeLink = vm.parseJsonAddress(activeJson, "$.common.linkToken");
        address faucetAddr = vm.parseJsonAddress(activeJson, "$.contracts.faucet");

        // Helper chain config
        string memory helperPath = string.concat(
            vm.projectRoot(),
            "/../ccip-faucet-fe/public/configs/chains/helpers/",
            helperName,
            ".json"
        );
        string memory helperJson = vm.readFile(helperPath);
        address helperLink = vm.parseJsonAddress(helperJson, "$.common.linkToken");
        address helperAddr = vm.parseJsonAddress(helperJson, "$.contracts.helper");

        vm.startBroadcast(pk);
        if (_eq(target, "active")) {
            bool ok = IERC20(activeLink).transfer(faucetAddr, amount);
            require(ok, "LINK transfer to faucet failed");
        } else if (_eq(target, "helper")) {
            bool ok2 = IERC20(helperLink).transfer(helperAddr, amount);
            require(ok2, "LINK transfer to helper failed");
        } else {
            revert("TARGET must be 'active' or 'helper'");
        }
        vm.stopBroadcast();

        console2.log("=== Funding Result ===");
        console2.log("Target:", target);
        console2.log("Amount (wei):", amount);
        console2.log("Faucet (active):", faucetAddr);
        console2.log("Active LINK:", activeLink);
        console2.log("Helper (helper):", helperAddr);
        console2.log("Helper LINK:", helperLink);
    }

    function _eq(string memory a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}


