// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
// We no longer import CCIPReceiver as we are handling it manually.
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

// We remove 'CCIPReceiver' from the inheritance list.
contract UniversalLinkBridge is Pausable {
    // --- State Variables ---
    LinkTokenInterface private immutable linkToken;
    address public owner;
    
    // ✅ FIX: We explicitly declare the router variable here.
    IRouterClient public i_router;

    mapping(uint64 => address) public supportedChains;

    // --- Events ---
    event ChainSupported(uint64 indexed chainSelector, address indexed contractAddress);
    event ChainRemoved(uint64 indexed chainSelector);
    event TokensWithdrawn(address indexed beneficiary, uint256 amount);
    event TokensLocked(bytes32 indexed messageId, address indexed sourceUser, uint256 amount);
    event TokensUnlocked(bytes32 indexed messageId, address indexed destinationUser, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // The constructor no longer calls the CCIPReceiver constructor.
    constructor(address _router, address _link) {
        owner = msg.sender;
        linkToken = LinkTokenInterface(_link);
        // ✅ FIX: We explicitly initialize our router variable.
        i_router = IRouterClient(_router);
    }

    // --- Owner-Only Management Functions ---
    // (These functions remain unchanged)

    function addChain(uint64 _selector, address _contractAddress) external onlyOwner {
        require(_contractAddress != address(0), "Address cannot be zero");
        supportedChains[_selector] = _contractAddress;
        emit ChainSupported(_selector, _contractAddress);
    }

    function removeChain(uint64 _selector) external onlyOwner {
        require(supportedChains[_selector] != address(0), "Chain not supported");
        delete supportedChains[_selector];
        emit ChainRemoved(_selector);
    }

    function withdraw(address _beneficiary, uint256 _amount) external onlyOwner {
        uint256 contractBalance = linkToken.balanceOf(address(this));
        require(_amount <= contractBalance, "Insufficient balance");
        linkToken.transfer(_beneficiary, _amount);
        emit TokensWithdrawn(_beneficiary, _amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Core Bridge Logic ---

    function lockAndBridge(
        uint64 _destinationChainSelector,
        uint256 _amount
    ) external whenNotPaused returns (bytes32 messageId) {
        // This function logic is correct and remains unchanged.
        require(_amount > 0, "Amount must be greater than 0");
        address destinationContract = supportedChains[_destinationChainSelector];
        require(destinationContract != address(0), "Destination chain not supported");

        linkToken.transferFrom(msg.sender, address(this), _amount);

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destinationContract),
            data: abi.encode(msg.sender, _amount),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: "",
            feeToken: address(linkToken)
        });
        
        uint256 fee = i_router.getFee(_destinationChainSelector, message); 
        require(linkToken.balanceOf(address(this)) >= (fee + _amount), "Contract has insufficient LINK for fee");
        
        linkToken.approve(address(i_router), fee);

        messageId = i_router.ccipSend(_destinationChainSelector, message);
        emit TokensLocked(messageId, msg.sender, _amount);
        return messageId;
    }

    /**
     * @notice This function now replaces the inherited _ccipReceive.
     * It must be named 'ccipReceive' to be called by the Router.
     */
    function ccipReceive(Client.Any2EVMMessage memory _message) external {
        require(msg.sender == address(i_router), "Only router can call this function");

        address sourceContract = supportedChains[_message.sourceChainSelector];
        address incomingSender = abi.decode(_message.sender, (address));

        require(sourceContract != address(0), "Source chain not supported");
        require(incomingSender == sourceContract, "Invalid sender contract");

        (address user, uint256 amount) = abi.decode(_message.data, (address, uint256));

        require(linkToken.balanceOf(address(this)) >= amount, "Insufficient balance to unlock");
        linkToken.transfer(user, amount);

        emit TokensUnlocked(_message.messageId, user, amount);
    }
}
