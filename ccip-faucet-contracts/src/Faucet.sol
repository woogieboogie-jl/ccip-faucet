// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Chainlink CCIP interfaces (aligned with remappings)
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

// Chainlink Price Feed interface for same-chain volatility detection
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title Faucet
 * @notice Dual-reservoir faucet for native tokens & LINK.
 *         Uses Chainlink CCIP to fetch volatility data from VolatilityHelper.
 */
contract Faucet is CCIPReceiver, Ownable(msg.sender) {
    // =============================================================
    // --------------------------- TYPES ---------------------------
    // =============================================================

    struct Reservoir {
        uint256 dispensablePool; // Remaining tokens available for drip
        uint256 dripRate;        // Tokens dispensed per request (dynamic)
    }

    // -------------------------------------------------------------------------
    // Minimal EIP-4337 UserOperation struct (only fields we need).
    // -------------------------------------------------------------------------
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    // =============================================================
    // ----------------------- STATE/IMMUTABLE ---------------------
    // =============================================================

    // Tokens
    // Native tokens handled via address(this).balance – no IERC20.
    IERC20 public immutable LINK;

    // Cool-down period (per user per token). Mutable so the owner can adjust.
    uint256 public COOLDOWN = 6 hours;

    /// @notice Emitted whenever the cooldown period is updated.
    /// @param newCooldown The new cooldown value in seconds.
    event CooldownUpdated(uint256 newCooldown);

    // Mapping for last claim timestamp per user per token
    mapping(address => uint256) public lastClaimNative;
    mapping(address => uint256) public lastClaimLink;

    // Reservoirs
    Reservoir private nativeRes;
    Reservoir private linkRes;
    
    // Configurable reservoir capacities (can be adjusted by owner)
    uint256 public nativeReservoirCapacity = 100 ether; // Native token reservoir capacity
    uint256 public linkReservoirCapacity = 100 ether; // LINK reservoir capacity

    // Refill threshold factor. Reservoir is considered "low" when
    // dispensablePool < dripRate * thresholdFactor.
    uint256 public thresholdFactor = 10; // default same logic as before (dripRate * 10 ~= 20%)

    // Capacity multiplier: reservoirCapacity = dripRate × thresholdFactor × capacityFactor
    uint256 public capacityFactor = 5; // default 5 ⇒ capacity = 5 × threshold

    // Base drip rates set at deployment - these never change and represent the initial values
    uint256 public BASENATIVEDRIPRATE;  // Initial native drip rate from deployment
    uint256 public BASELINKDRIPRATE; // Initial LINK drip rate from deployment

    /// @notice Emitted when the threshold factor is updated by the owner.
    event ThresholdFactorUpdated(uint256 newFactor);
    
    /// @notice Emitted when reservoir capacity is updated by the owner.
    event ReservoirCapacityUpdated(address indexed token, uint256 newCapacity);

    /// @notice Emitted when the capacity factor is updated by the owner.
    event CapacityFactorUpdated(uint256 newFactor);
    
    /// @notice Emitted when owner withdraws tokens from treasury.
    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount);

    /// @notice Mutex to prevent multiple concurrent refill requests.
    bool public refillInProgress;

    // Pending messageIds => requested asset flags
    struct PendingFlags { bool native; bool link; }
    mapping(bytes32 => PendingFlags) public pendingRequests;

    // Cross-chain / CCIP
    IRouterClient public immutable router;
    uint64 public immutable helperChainSelector; // e.g., Fuji 14767482510784806043
    mapping(uint64 => address) public trustedSenders; // chainSelector => helper contract

    // Function selectors
    bytes4 private constant REQ_NATIVE_SELECTOR = bytes4(keccak256("requestNativeTokens()"));

    // =============================================================
    // ---------------------------- EVENTS -------------------------
    // =============================================================

    event Drip(address indexed user, address indexed token, uint256 amount);
    event RefillTriggered(bytes32 indexed messageId);
    event ReservoirRefilled(address indexed token, uint256 newDripRate, uint256 newPool);

    /// @notice Emitted when a volatility response is received from the helper.
    /// @param responseMessageId  CCIP inbound messageId carrying the volatility data
    /// @param volatilityScore    0-1000 score after clamping/division in helper
    event VolatilityReceived(bytes32 indexed responseMessageId, uint256 volatilityScore);
    event Deposit(address indexed from, uint256 amount);
    event RefillStateReset(uint256 clearedMessageCount);

    // =============================================================
    // ------------------------ CONSTRUCTOR ------------------------
    // =============================================================

    constructor(
        address _router,
        uint64 _helperChainSelector,
        address /* _volatilityHelper */,
        address _link,
        uint256 _initialNativeDrip,
        uint256 _initialLinkDrip
    ) payable CCIPReceiver(_router) {
        router = IRouterClient(_router);
        helperChainSelector = _helperChainSelector;
        LINK = IERC20(_link);
        // trustedSenders will be set via addChain() after helper deployment
        nativeRes.dripRate = _initialNativeDrip;
        linkRes.dripRate = _initialLinkDrip;
        BASENATIVEDRIPRATE = _initialNativeDrip;
        BASELINKDRIPRATE = _initialLinkDrip;

        // Derive initial capacities from factors so they start consistent
        _recalculateCaps();
    }

    // =============================================================
    // --------------------- USER-FACING (DRIP) --------------------
    // =============================================================

    function requestNativeTokens() external {
        _dripNative();
    }

    /// @notice Request native tokens to be sent to a specific address (useful for AA)
    /// @param recipient The address that should receive the native tokens
    function requestNativeTokensTo(address payable recipient) external {
        _dripNativeTo(recipient);
    }

    function requestLinkTokens() external {
        _drip(LINK, linkRes, lastClaimLink);
    }

    // =============================================================
    // ----------------------- ADMIN / PUBLIC ----------------------
    // =============================================================

    /// @notice Anyone can call; reverts if refill not required.
    function triggerRefillCheck() external payable {
        // Need refill?
        bool needNative = _belowThreshold(nativeRes);
        bool needLink = _belowThreshold(linkRes);
        require(needNative || needLink, "Reservoirs sufficiently full");

        // Prevent spamming while a refill request is still pending
        require(!refillInProgress, "Refill already pending");

        // Get helper/feed address
        address helper = trustedSenders[helperChainSelector];
        require(helper != address(0), "Helper not set");

        // 🎯 SAME-CHAIN DETECTION: Check if helper is actually a volatility feed
        if (_isVolatilityFeed(helper)) {
            // Same-chain: Direct volatility access
            _handleSameChainRefill(needNative, needLink, helper);
        } else {
            // Cross-chain: Existing CCIP logic (unchanged)
            _handleCrossChainRefill(needNative, needLink, helper);
        }
    }

    // =============================================================
    // ----------------------- CCIP RECEIVE ------------------------
    // =============================================================

    /// @inheritdoc CCIPReceiver
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        // Existing validation (unchanged)
        require(message.sourceChainSelector == helperChainSelector, "Invalid source chain");
        address src = abi.decode(message.sender, (address));
        require(src == trustedSenders[helperChainSelector], "Invalid sender");

        (bytes32 requestId, uint256 volatility) = abi.decode(message.data, (bytes32, uint256));
        PendingFlags memory flags = pendingRequests[requestId];
        require(flags.native || flags.link, "Unknown requestId");
        
        delete pendingRequests[requestId];
        
        // Use extracted logic for consistency
        _applyVolatilityAndRefill(flags.native, flags.link, volatility, message.messageId);
    }

    // =============================================================
    // ------------------------ INTERNALS --------------------------
    // =============================================================

    /// @notice Detect if address is a Chainlink price feed (volatility feed)
    /// @dev Uses staticcall with gas limit and data length check for reliability across chains
    function _isVolatilityFeed(address addr) internal view returns (bool) {
        // Single low-level staticcall with controlled gas
        // If it's a feed: succeeds and returns valid data (160 bytes = 5 return values)
        // If it's not a feed or doesn't exist on this chain: fails or returns wrong data length
        (bool success, bytes memory data) = addr.staticcall{gas: 50000}(
            abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector)
        );
        // Must succeed AND return proper data length (5 × 32 bytes = 160 bytes)
        // This handles Arbitrum's behavior where calls to non-existent addresses return success=true
        return success && data.length == 160;
    }

    /// @notice Handle same-chain refill with direct volatility access
    function _handleSameChainRefill(bool needNative, bool needLink, address feedAddr) internal {
        // Set mutex to prevent concurrent calls
        refillInProgress = true;
        
        // Direct volatility fetch from price feed
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddr);
        (, int256 price,,,) = feed.latestRoundData();
        
        // Convert price to volatility score (0-1000)
        uint256 volatility = _convertPriceToVolatility(price);
        
        // Generate a pseudo-messageId for event compatibility
        bytes32 messageId = keccak256(abi.encodePacked(block.timestamp, block.number, feedAddr));
        
        // Apply volatility and refill (reuse existing logic)
        _applyVolatilityAndRefill(needNative, needLink, volatility, messageId);
    }

    /// @notice Handle cross-chain refill via CCIP (existing logic extracted)
    function _handleCrossChainRefill(bool needNative, bool needLink, address helper) internal {
        // Existing CCIP logic - unchanged!
        Client.EVM2AnyMessage memory msgData = Client.EVM2AnyMessage({
            receiver: abi.encode(helper),
            data: bytes(""),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 200_000})),
            feeToken: address(LINK)
        });

        uint256 fee = router.getFee(helperChainSelector, msgData);
        if (LINK.allowance(address(this), address(router)) < fee) {
            LINK.approve(address(router), type(uint256).max);
        }

        bytes32 messageId = router.ccipSend(helperChainSelector, msgData);
        
        refillInProgress = true;
        pendingRequests[messageId] = PendingFlags({native: needNative, link: needLink});
        emit RefillTriggered(messageId);
    }

    /// @notice Extract volatility application logic from _ccipReceive for reuse
    function _applyVolatilityAndRefill(bool needNative, bool needLink, uint256 volatility, bytes32 messageId) internal {
        // Clear refill mutex
        refillInProgress = false;
        
        // Emit volatility for frontend (same event signature!)
        emit VolatilityReceived(messageId, volatility);

        // Apply volatility (existing logic from _ccipReceive)
        uint256 newNativeDrip = _mapVolToDrip(volatility, 2 ether, 0.5 ether);
        uint256 newLinkDrip = _mapVolToDrip(volatility, 10 ether, 2 ether);
        
        // Safety checks
        uint256 maxNativeDrip = nativeReservoirCapacity / (thresholdFactor + 5);
        uint256 maxLinkDrip = linkReservoirCapacity / (thresholdFactor + 5);
        
        if (newNativeDrip > maxNativeDrip) newNativeDrip = maxNativeDrip;
        if (newLinkDrip > maxLinkDrip) newLinkDrip = maxLinkDrip;

        // Refill reservoirs
        if (needNative) {
            _topUpNativeReservoir();
            nativeRes.dripRate = newNativeDrip;
            emit ReservoirRefilled(address(0), newNativeDrip, nativeRes.dispensablePool);
        }

        if (needLink) {
            _topUpReservoir(linkRes, LINK, linkReservoirCapacity);
            linkRes.dripRate = newLinkDrip;
            emit ReservoirRefilled(address(LINK), newLinkDrip, linkRes.dispensablePool);
        }

        _recalculateCaps();
    }

    /// @notice Convert price feed value to volatility score
    function _convertPriceToVolatility(int256 price) internal pure returns (uint256) {
        // Convert price to volatility score (0-1000)
        // Simple volatility calculation based on price magnitude
        uint256 absPrice = price >= 0 ? uint256(price) : uint256(-price);
        
        // Scale price to volatility (adjust divisor based on your feed's decimals)
        // For ETH/USD feed (8 decimals), this gives reasonable volatility range
        uint256 volatility = (absPrice / 1e6) % 1000;
        
        return volatility > 1000 ? 1000 : volatility;
    }

    function _dripNative() internal {
        address user = tx.origin; // Get the actual EOA that initiated the transaction
        require(block.timestamp - lastClaimNative[user] >= COOLDOWN, "Cooldown");
        require(nativeRes.dispensablePool >= nativeRes.dripRate, "Reservoir empty");

        nativeRes.dispensablePool -= nativeRes.dripRate;
        lastClaimNative[user] = block.timestamp;

        (bool sent, ) = payable(user).call{value: nativeRes.dripRate}("");
        require(sent, "Transfer failed");
        emit Drip(user, address(0), nativeRes.dripRate);
    }

    function _dripNativeTo(address payable recipient) internal {
        // Use recipient address for cooldown tracking instead of tx.origin
        // This ensures each user has their own cooldown even when using Account Abstraction
        require(block.timestamp - lastClaimNative[recipient] >= COOLDOWN, "Cooldown");
        require(nativeRes.dispensablePool >= nativeRes.dripRate, "Reservoir empty");

        nativeRes.dispensablePool -= nativeRes.dripRate;
        lastClaimNative[recipient] = block.timestamp;

        (bool sent, ) = recipient.call{value: nativeRes.dripRate}("");
        require(sent, "Transfer failed");
        emit Drip(recipient, address(0), nativeRes.dripRate);
    }

    function _drip(
        IERC20 token,
        Reservoir storage res,
        mapping(address => uint256) storage lastClaim
    ) internal {
        require(block.timestamp - lastClaim[msg.sender] >= COOLDOWN, "Cooldown");
        require(res.dispensablePool >= res.dripRate, "Reservoir empty");

        res.dispensablePool -= res.dripRate;
        lastClaim[msg.sender] = block.timestamp;
        token.transfer(msg.sender, res.dripRate);
        emit Drip(msg.sender, address(token), res.dripRate);
    }

    function _belowThreshold(Reservoir storage res) internal view returns (bool) {
        uint256 threshold = res.dripRate * thresholdFactor;
        return res.dispensablePool < threshold;
    }

    function _topUpReservoir(Reservoir storage res, IERC20 token, uint256 capacity) internal {
        uint256 missing = capacity - res.dispensablePool;
        if (missing == 0) return;

        // How many LINK tokens are actually available in treasury beyond what
        // is already counted in the reservoir?
        uint256 available = token.balanceOf(address(this));

        // Safety: if for some reason the recorded pool is higher than the real
        // balance, treat available as zero.
        if (available <= res.dispensablePool) return;

        uint256 freeBalance = available - res.dispensablePool;
        uint256 toAdd = freeBalance < missing ? freeBalance : missing;
        res.dispensablePool += toAdd;
    }

    /**
     * @dev Top-up native reservoir with *unallocated* treasury balance only.
     *      This mirrors the LINK logic and prevents the same native tokens from being
     *      counted twice. The invariant after this function is:
     *      nativeRes.dispensablePool + (treasury balance) == address(this).balance.
     */
    function _topUpNativeReservoir() internal {
        if (nativeRes.dispensablePool >= nativeReservoirCapacity) return;

        uint256 totalBalance = address(this).balance;

        // If somehow recorded pool exceeds or equals real balance, do nothing.
        if (totalBalance <= nativeRes.dispensablePool) return;

        uint256 freeBalance = totalBalance - nativeRes.dispensablePool; // Tokens not yet in reservoir
        uint256 missing     = nativeReservoirCapacity - nativeRes.dispensablePool;
        uint256 toAdd       = freeBalance < missing ? freeBalance : missing;

        if (toAdd == 0) return;
            nativeRes.dispensablePool += toAdd;
    }

    function _mapVolToDrip(uint256 vol, uint256 maxDrip, uint256 minDrip) internal pure returns (uint256) {
        // vol assumed 0-1000; higher vol => lower drip
        if (vol > 1000) vol = 1000;
        uint256 range = maxDrip - minDrip;
        uint256 drip = minDrip + (range * vol / 1000);
        return drip;
    }

    // -------------------------------------------------------------
    // Internal helper: recompute native & LINK reservoir capacities
    // capacity = dripRate × thresholdFactor × capacityFactor
    // -------------------------------------------------------------
    function _recalculateCaps() internal {
        nativeReservoirCapacity = nativeRes.dripRate * thresholdFactor * capacityFactor;
        linkReservoirCapacity = linkRes.dripRate * thresholdFactor * capacityFactor;
    }

    // =============================================================
    // --------------- EIP-4337 Paymaster Validation ---------------
    // =============================================================

    /// @notice Called by Paymaster during validation phase to determine if gas should be sponsored.
    ///         Allows sponsoring gas for a user's *first* native token claim only.
    /// @param userOp The full UserOperation struct
    /// @param _userOpHash Hash of the UserOperation (unused)
    /// @param _maxCost Maximum cost that the paymaster will pay (unused)
    /// @return context Data to be passed to postOp (empty in our case)
    /// @return validationData Packed validation result (0 = success, 1 = failure)
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 _userOpHash,
        uint256 _maxCost
    ) external view returns (bytes memory context, uint256 validationData) {
        // Silence unused parameter warnings with void statements
        _userOpHash; _maxCost;
        
        // Extract the recipient address from the UserOperation calldata
        // For requestNativeTokensTo(address), the recipient is the first parameter
        address recipient = _extractRecipientFromCalldata(userOp.callData);
        
        // Check if this is a valid first-time native token claim for the actual recipient
        bool isValid = _isValidFirstTimeClaim(recipient);
        
        // Return empty context and validation result
        // validationData: 0 = success, 1 = failure
        return ("", isValid ? 0 : 1);
    }

    /// @notice Extract recipient address from UserOperation calldata
    /// @param callData The calldata from the UserOperation
    /// @return recipient The recipient address, or zero address if extraction fails
    function _extractRecipientFromCalldata(bytes calldata callData) internal pure returns (address recipient) {
        // Check if this is a call to requestNativeTokensTo(address)
        // Function selector: bytes4(keccak256("requestNativeTokensTo(address)"))
        if (callData.length >= 36 && bytes4(callData[:4]) == bytes4(keccak256("requestNativeTokensTo(address)"))) {
            // Extract the address parameter (bytes 4-35)
            recipient = address(uint160(uint256(bytes32(callData[4:36]))));
        }
        // If it's not requestNativeTokensTo, return zero address (will fail validation)
        return recipient;
    }

    /// @notice Helper function to check if user is eligible for sponsored first native token claim
    function _isValidFirstTimeClaim(address user) internal view returns (bool) {
        // Check the actual user address passed in (which should be the recipient)
        // instead of tx.origin for Account Abstraction compatibility
        
        // User must have never claimed native before
        if (lastClaimNative[user] != 0) return false;
        
        // User must have zero native balance (truly new user)
        if (user.balance != 0) return false;
        
        // Reservoir must have enough tokens to serve the request
        if (nativeRes.dispensablePool < nativeRes.dripRate) return false;
        
        return true;
    }

    // -------------------------------------------------------------
    // Admin: register trusted helper for a source chain
    // -------------------------------------------------------------
    function addChain(uint64 selector, address helper) external onlyOwner {
        trustedSenders[selector] = helper;
    }

    // =============================================================
    // -------------------- FUNDING (receive native) ---------------
    // =============================================================

    /// @notice Deposit native tokens into the faucet treasury and (optionally) auto-top-up the reservoir.
    function deposit() public payable {
        require(msg.value > 0, "No native tokens sent");
        emit Deposit(msg.sender, msg.value);
        // FIXED: Don't auto-top-up reservoir on deposit - keep funds in treasury
        // Treasury represents "deep reserves" that can refill tanks via CCIP
        // _topUpNativeReservoir(); // REMOVED: Let treasury accumulate funds
    }

    /// @dev Fallback native transfers funnel into deposit()
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
        // FIXED: Don't auto-top-up reservoir on deposit - keep funds in treasury
        // _topUpNativeReservoir(); // REMOVED: Let treasury accumulate funds
    }

    // =============================================================
    // -------------------- MINIMAL VIEW FUNCTIONS -----------------
    // =============================================================

    /// @notice Get reservoir status (only data that can't be computed client-side)
    function getReservoirStatus() external view returns (
        uint256 nativePool, uint256 nativeDripRate,
        uint256 linkPool, uint256 linkDripRate
    ) {
        return (nativeRes.dispensablePool, nativeRes.dripRate, linkRes.dispensablePool, linkRes.dripRate);
    }

    /// @notice Diagnostic function to check refill state and pending messages
    /// @param messageIds Array of messageIds to check status for
    /// @return isRefillInProgress Whether a refill is currently in progress
    /// @return pendingStates Array of booleans indicating which messageIds are pending
    function getRefillDiagnostics(bytes32[] calldata messageIds) external view returns (
        bool isRefillInProgress,
        bool[] memory pendingStates
    ) {
        isRefillInProgress = refillInProgress;
        pendingStates = new bool[](messageIds.length);
        
        for (uint256 i = 0; i < messageIds.length; i++) {
            PendingFlags memory flags = pendingRequests[messageIds[i]];
            pendingStates[i] = flags.native || flags.link;
        }
        
        return (isRefillInProgress, pendingStates);
    }

    // =============================================================
    // -------------------------- ADMIN ----------------------------
    // =============================================================

    /// @notice Allows the contract owner to update the global cooldown period.
    /// @param newCooldown The new cooldown in seconds. Cannot be zero.
    function setCooldown(uint256 newCooldown) external onlyOwner {
        require(newCooldown > 0, "Cooldown cannot be zero");
        COOLDOWN = newCooldown;
        emit CooldownUpdated(newCooldown);
    }

    /// @notice Owner can update the thresholdFactor.
    function setThresholdFactor(uint256 newFactor) external onlyOwner {
        require(newFactor > 0, "factor zero");
        thresholdFactor = newFactor;
        emit ThresholdFactorUpdated(newFactor);

        // Keep capacities aligned with new threshold
        _recalculateCaps();
    }

    /// @notice Owner can update the capacityFactor (multiplier applied to threshold).
    ///         Reservoir capacity = dripRate × thresholdFactor × capacityFactor.
    function setCapacityFactor(uint256 newFactor) external onlyOwner {
        require(newFactor > 0, "factor zero");
        capacityFactor = newFactor;
        emit CapacityFactorUpdated(newFactor);
        _recalculateCaps();
    }

    /// @notice Emergency function to reset refill state if CCIP gets stuck
    /// @param messageIds Array of messageIds to clear from pending (optional - pass empty array to skip)
    /// @dev Use this if a CCIP message gets stuck and users can't trigger new refills
    function emergencyResetRefillState(bytes32[] calldata messageIds) external onlyOwner {
        // Clear the main mutex
        refillInProgress = false;
        
        // Clear specific pending messages if provided
        for (uint256 i = 0; i < messageIds.length; i++) {
            delete pendingRequests[messageIds[i]];
        }
        
        emit RefillStateReset(messageIds.length);
    }

    /// @notice Update native reservoir capacity
    /// @param newCapacity New capacity for native reservoir in wei
    function setNativeReservoirCapacity(uint256 newCapacity) external onlyOwner {
        require(newCapacity > 0, "Capacity cannot be zero");
        nativeReservoirCapacity = newCapacity;
        emit ReservoirCapacityUpdated(address(0), newCapacity); // address(0) for native
        
        // If new capacity is smaller than current pool, reduce the pool
        if (nativeRes.dispensablePool > newCapacity) {
            nativeRes.dispensablePool = newCapacity;
        }
        // FIXED: Don't auto-refill from treasury when capacity increases
        // Owner must manually call refillReservoirFromTreasury if desired
    }

    /// @notice Update LINK reservoir capacity
    /// @param newCapacity New capacity for LINK reservoir in wei
    function setLinkReservoirCapacity(uint256 newCapacity) external onlyOwner {
        require(newCapacity > 0, "Capacity cannot be zero");
        linkReservoirCapacity = newCapacity;
        emit ReservoirCapacityUpdated(address(LINK), newCapacity);
        
        // If new capacity is smaller than current pool, reduce the pool
        if (linkRes.dispensablePool > newCapacity) {
            linkRes.dispensablePool = newCapacity;
        }
        // FIXED: Don't auto-refill from treasury when capacity increases
        // Owner must manually call refillReservoirFromTreasury if desired
    }

    /// @notice Manual function for owner to refill reservoirs from treasury
    /// @param refillNative Whether to refill native reservoir from treasury
    /// @param refillLink Whether to refill LINK reservoir from treasury
    function refillReservoirFromTreasury(bool refillNative, bool refillLink) external onlyOwner {
        if (refillNative) {
            _topUpNativeReservoir();
        }
        if (refillLink) {
            _topUpReservoir(linkRes, LINK, linkReservoirCapacity);
        }
    }

    /// @notice Emergency withdrawal of native tokens from treasury (not from reservoir)
    /// @param to Address to send the withdrawn native tokens
    /// @param amount Amount of native tokens to withdraw in wei
    /// @dev Only withdraws from treasury balance, not from the reservoir
    function emergencyWithdrawNative(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        
        // Calculate available treasury balance (total balance minus reservoir)
        uint256 totalBalance = address(this).balance;
        uint256 treasuryBalance = totalBalance > nativeRes.dispensablePool ? totalBalance - nativeRes.dispensablePool : 0;
        
        require(treasuryBalance >= amount, "Insufficient treasury balance");
        
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
        
        emit EmergencyWithdrawal(address(0), to, amount); // address(0) for native
    }

    /// @notice Emergency withdrawal of LINK tokens from treasury (not from reservoir)
    /// @param to Address to send the withdrawn LINK
    /// @param amount Amount of LINK to withdraw in wei
    /// @dev Only withdraws from treasury balance, not from the reservoir
    function emergencyWithdrawLink(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        
        // Calculate available treasury balance (total balance minus reservoir)
        uint256 totalBalance = LINK.balanceOf(address(this));
        uint256 treasuryBalance = totalBalance > linkRes.dispensablePool ? totalBalance - linkRes.dispensablePool : 0;
        
        require(treasuryBalance >= amount, "Insufficient treasury balance");
        
        bool success = LINK.transfer(to, amount);
        require(success, "Transfer failed");
        
        emit EmergencyWithdrawal(address(LINK), to, amount);
    }

    /// @notice Get detailed treasury and reservoir balances for both tokens
    /// @return nativeTreasury Native treasury balance (total - reservoir)
    /// @return nativeReservoir Native reservoir balance
    /// @return linkTreasury LINK treasury balance (total - reservoir)  
    /// @return linkReservoir LINK reservoir balance
    /// @return nativeCapacity Native reservoir capacity
    /// @return linkCapacity LINK reservoir capacity
    function getTreasuryStatus() external view returns (
        uint256 nativeTreasury,
        uint256 nativeReservoir,
        uint256 linkTreasury,
        uint256 linkReservoir,
        uint256 nativeCapacity,
        uint256 linkCapacity
    ) {
        uint256 nativeTotal = address(this).balance;
        uint256 linkTotal = LINK.balanceOf(address(this));
        
        nativeReservoir = nativeRes.dispensablePool;
        linkReservoir = linkRes.dispensablePool;
        
        nativeTreasury = nativeTotal > nativeReservoir ? nativeTotal - nativeReservoir : 0;
        linkTreasury = linkTotal > linkReservoir ? linkTotal - linkReservoir : 0;
        
        nativeCapacity = nativeReservoirCapacity;
        linkCapacity = linkReservoirCapacity;
        
        return (nativeTreasury, nativeReservoir, linkTreasury, linkReservoir, nativeCapacity, linkCapacity);
    }
} 
