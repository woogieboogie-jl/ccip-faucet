// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol"; // If needed
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";

contract FaucetLock {
    address private owner;
    IRouterClient private router;
    IERC20 private linkToken;

    // The Chain Selector for Monad Testnet is now public!
    uint64 public constant MONAD_TESTNET_SELECTOR = 2183018362218727504;
    
    // Address of your corresponding contract on Monad Testnet
    address public destinationContract;

    event TokensLockedAndMessageSent(bytes32 indexed messageId, address indexed recipient, uint256 amount);

    constructor(address _router, address _link) {
        router = IRouterClient(_router);
        linkToken = LinkTokenInterface(_link);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // Set the address of the FaucetUnlock contract deployed on Monad Testnet
    function setDestinationContract(address _destinationAddress) public onlyOwner {
        destinationContract = _destinationAddress;
    }

    function lockAndSendMessage(uint256 _amount) public {
        require(_amount > 0, "Amount must be greater than 0");
        require(destinationContract != address(0), "Destination contract not set");

        // Transfer LINK tokens from the user to this contract for locking
        require(linkToken.transferFrom(msg.sender, address(this), _amount), "Token transfer failed");

        // Create the message to be sent to Monad Testnet
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destinationContract),
            data: abi.encode(msg.sender, _amount), // Pass the original sender and the amount
            tokenAmounts: new Client.EVMTokenAmount[](0), // We are not using CCIP token pools
            extraArgs: "",
            feeToken: address(linkToken) // Pay fees in LINK tokens
        });

        // Get the fee required for the CCIP message
        uint256 fee = router.getFee(MONAD_TESTNET_SELECTOR, message);

        // Approve the router to spend the fee
        require(linkToken.approve(address(router), fee), "Fee approval failed");

        // Send the message via the CCIP Router
        bytes32 messageId = router.ccipSend(MONAD_TESTNET_SELECTOR, message);

        emit TokensLockedAndMessageSent(messageId, msg.sender, _amount);
    }
}
