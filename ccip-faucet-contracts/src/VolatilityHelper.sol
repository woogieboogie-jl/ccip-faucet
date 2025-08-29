// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VolatilityHelper
 * @notice Stateless CCIP application deployed on helperChain and Responds with 24h realized volatility on supporting assets.
 */
contract VolatilityHelper is CCIPReceiver, Ownable(msg.sender) {
    // =============================================================
    // ----------------------- STATE/IMMUTABLE ---------------------
    // =============================================================

    IERC20 public immutable LINK;
    IRouterClient public immutable router;
    // Whitelist of allowed source chains and their faucet addresses
    mapping(uint64 => address) public selectorToFaucet;

    AggregatorV3Interface public immutable volatilityFeed; // ETH/USD 24h Realised Volatility feed

    event Deposit(address indexed from, uint256 amount);

    event VolatilityResponseSent(
        bytes32 indexed responseMessageId,
        bytes32 indexed originalRequestId, 
        uint256 volatilityValue,
        address indexed faucetAddress
    );

    // =============================================================
    // ------------------------ CONSTRUCTOR ------------------------
    // =============================================================

    constructor(
        address _router,
        address _volatilityFeed,
        address _link
    ) CCIPReceiver(_router) {
        router = IRouterClient(_router);
        volatilityFeed = AggregatorV3Interface(_volatilityFeed);
        LINK = IERC20(_link);
    }

    /// @notice Register an allowed source chain and its faucet
    function addSource(uint64 sourceSelector, address faucet) external onlyOwner {
        selectorToFaucet[sourceSelector] = faucet;
    }

    /// @notice Remove an allowed source chain mapping
    function removeSource(uint64 sourceSelector) external onlyOwner {
        delete selectorToFaucet[sourceSelector];
    }

    // =============================================================
    // ----------------------- CCIP RECEIVE ------------------------
    // =============================================================

    /// @inheritdoc CCIPReceiver
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        address expectedFaucet = selectorToFaucet[message.sourceChainSelector];
        require(expectedFaucet != address(0), "Source not allowed");
        // Decode the EVM sender address and compare directly for robustness
        address src = abi.decode(message.sender, (address));
        require(src == expectedFaucet, "Invalid sender");

        // Fetch volatility value (scaled by 1e8 like price feeds)
        (, int256 vol,,,) = volatilityFeed.latestRoundData();
        // The feed is scaled by 1e2 (two implied decimals). Convert to an
        // integer score in the 0-1000 range expected by the Monad faucet.
        uint256 valueRaw = uint256(vol);
        uint256 score = valueRaw / 100;            // eg 67415 → 674
        if (score > 1000) score = 1000;           // clamp just in case

        // Build response message with (requestId, volatility) so the faucet
        // can correlate the reply.
        Client.EVM2AnyMessage memory response = Client.EVM2AnyMessage({
            receiver: message.sender, // faucet encoded bytes
            data: abi.encode(message.messageId, score),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 200_000})),
            feeToken: address(LINK) // pay fee in LINK token
        });

        // Ensure sufficient allowance for LINK fee
        uint256 fee = router.getFee(message.sourceChainSelector, response);
        if (LINK.allowance(address(this), address(router)) < fee) {
            LINK.approve(address(router), type(uint256).max);
        }

        // Send back to the originating chain and capture the response messageId
        bytes32 responseMessageId = router.ccipSend(message.sourceChainSelector, response);
        
        emit VolatilityResponseSent(
            responseMessageId,
            message.messageId, // Original request ID from Monad
            score,             // Scaled volatility score being sent
            expectedFaucet     // Destination faucet address
        );
    }

    /// @notice Accept native AVAX just in case someone funds it; not used in logic.
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
} 
 
