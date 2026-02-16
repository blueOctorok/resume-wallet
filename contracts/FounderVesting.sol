// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FounderVesting
 * @dev Vesting contract for founder STORM token allocation.
 * 
 * Schedule (per whitepaper):
 * - Year 1: 0% releasable (cliff - full lock)
 * - Year 2: Linear vest from 0% to 50%
 * - Year 3: Linear vest from 50% to 100%
 * 
 * In other words:
 * - Cliff: 1 year (no tokens can be released)
 * - Vesting duration: 2 years after cliff (linear)
 * - Total: 3 years from start to fully vested
 * 
 * The beneficiary can call release() at any time; they receive whatever has vested.
 */
contract FounderVesting is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // The STORM token
    IERC20 public immutable token;

    // Beneficiary (founder) who will receive the tokens
    address public immutable beneficiary;

    // Timestamps
    uint256 public immutable start;          // When vesting begins (deploy time)
    uint256 public immutable cliffEnd;       // End of cliff period (start + 1 year)
    uint256 public immutable vestingEnd;     // End of vesting (start + 3 years)

    // Durations in seconds
    uint256 public constant CLIFF_DURATION = 365 days;    // 1 year cliff
    uint256 public constant VESTING_DURATION = 730 days;  // 2 years linear vest after cliff

    // Total tokens allocated to this vesting contract
    uint256 public totalAllocation;

    // Tokens already released
    uint256 public released;

    // Events
    event TokensReleased(address indexed beneficiary, uint256 amount);

    /**
     * @dev Constructor sets beneficiary and calculates vesting schedule.
     * @param _token Address of the StormToken contract
     * @param _beneficiary Founder address who will receive vested tokens
     */
    constructor(address _token, address _beneficiary) {
        require(_token != address(0), "Invalid token address");
        require(_beneficiary != address(0), "Invalid beneficiary address");

        token = IERC20(_token);
        beneficiary = _beneficiary;

        start = block.timestamp;
        cliffEnd = block.timestamp + CLIFF_DURATION;
        vestingEnd = block.timestamp + CLIFF_DURATION + VESTING_DURATION;
    }

    /**
     * @dev Called once after deployment to record the total allocation.
     * The deploy script transfers tokens to this contract, then calls this.
     */
    function recordAllocation() external {
        require(totalAllocation == 0, "Allocation already recorded");
        totalAllocation = token.balanceOf(address(this));
        require(totalAllocation > 0, "No tokens to vest");
    }

    /**
     * @dev Returns the amount of tokens that have vested (but may not yet be released).
     */
    function vestedAmount() public view returns (uint256) {
        if (totalAllocation == 0) {
            return 0;
        }

        if (block.timestamp < cliffEnd) {
            // Still in cliff period - nothing vested
            return 0;
        } else if (block.timestamp >= vestingEnd) {
            // Fully vested
            return totalAllocation;
        } else {
            // Linear vesting after cliff
            // Time elapsed since cliff ended
            uint256 timeAfterCliff = block.timestamp - cliffEnd;
            // Linear proportion of total allocation
            return (totalAllocation * timeAfterCliff) / VESTING_DURATION;
        }
    }

    /**
     * @dev Returns the amount of tokens that can be released right now.
     */
    function releasable() public view returns (uint256) {
        return vestedAmount() - released;
    }

    /**
     * @dev Release vested tokens to the beneficiary.
     * Anyone can call this, but tokens always go to the beneficiary.
     */
    function release() external nonReentrant {
        uint256 amount = releasable();
        require(amount > 0, "No tokens to release");

        released += amount;
        token.safeTransfer(beneficiary, amount);

        emit TokensReleased(beneficiary, amount);
    }

    /**
     * @dev Returns vesting status for transparency.
     */
    function vestingStatus() external view returns (
        uint256 _totalAllocation,
        uint256 _vestedAmount,
        uint256 _releasedAmount,
        uint256 _releasableAmount,
        uint256 _cliffEndsAt,
        uint256 _vestingEndsAt,
        bool _cliffPassed,
        bool _fullyVested
    ) {
        return (
            totalAllocation,
            vestedAmount(),
            released,
            releasable(),
            cliffEnd,
            vestingEnd,
            block.timestamp >= cliffEnd,
            block.timestamp >= vestingEnd
        );
    }
}
