// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";

contract FaucetUnlock is CCIPReceiver {
    address private owner;
    IERC20 private linkTokenOnMonad;

    // Mapping to whitelist a source contract for each source chain
    // (chainSelector => sourceContractAddress)
    mapping(uint64 => address) public allowedSourceContracts;

    event TokensUnlocked(address indexed recipient, uint256 amount, uint64 sourceChainSelector);

    // Constructor for Monad Testnet
    constructor() CCIPReceiver(0x5f16e51e3Dcb255480F090157DD01bA962a53E54) { // Monad Testnet CCIP Router
        // Address of the LINK token on Monad Testnet
        linkTokenOnMonad = IERC20(0x6fE981Dbd557f81ff66836af0932cba535Cbc343);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // --- NEW: Whitelisting Functions ---
    /**
     * @notice Allows the owner to add or update the allowed source contract for a given chain.
     * @param _sourceChainSelector The CCIP chain selector of the source chain.
     * @param _sourceContractAddress The address of the FaucetLock contract on that source chain.
     */
    function allowSourceContract(uint64 _sourceChainSelector, address _sourceContractAddress) public onlyOwner {
        allowedSourceContracts[_sourceChainSelector] = _sourceContractAddress;
    }

    /**
     * @notice Allows the owner to remove a source contract from the whitelist.
     * @param _sourceChainSelector The CCIP chain selector of the source chain to remove.
     */
    function disallowSourceContract(uint64 _sourceChainSelector) public onlyOwner {
        allowedSourceContracts[_sourceChainSelector] = address(0);
    }

    // --- UPDATED: Main CCIP Receive Logic ---
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        uint64 sourceChainSelector = message.sourceChainSelector;
        
        // Security Check: Look up the allowed sender from our mapping
        address allowedSender = allowedSourceContracts[sourceChainSelector];

        // Ensure the source chain is whitelisted AND the sender matches the whitelisted address
        require(allowedSender != address(0), "Source chain not allowed");
        require(keccak256(message.sender) == keccak256(abi.encode(allowedSender)), "Invalid source contract");

        // Decode the data sent from the source contract
        (address recipient, uint256 amount) = abi.decode(message.data, (address, uint256));
        
        // This contract must be pre-funded with enough LINK on Monad
        require(linkTokenOnMonad.transfer(recipient, amount), "Token transfer failed");

        emit TokensUnlocked(recipient, amount, sourceChainSelector);
    }
}
