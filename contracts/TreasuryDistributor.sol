// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TreasuryDistributor
 * @dev Holds the 15M STORM treasury pool for referral rewards, community
 *      programs, partnerships, and buybacks.
 * 
 * Unlike RewardDistributor (which uses a decay formula for USDC-backed
 * user rewards), this contract distributes fixed amounts for specific
 * events — e.g. 2.5 STORM to each party on a successful referral.
 * 
 * Security:
 * - Only addresses with DISTRIBUTOR_ROLE can call distribute()
 * - ReentrancyGuard prevents reentrancy attacks
 * - SafeERC20 for safe token transfers
 * - Tracks total distributed for transparency
 */
contract TreasuryDistributor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    IERC20 public immutable stormToken;

    uint256 public totalDistributed;

    event TreasuryDistributed(address indexed recipient, uint256 amount, uint256 totalDistributedAfter);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    constructor(address _stormToken) {
        require(_stormToken != address(0), "Invalid token address");
        stormToken = IERC20(_stormToken);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
    }

    /**
     * @dev Distribute STORM tokens from the treasury to a recipient.
     * @param to Recipient address
     * @param amount Amount of STORM tokens in wei (18 decimals)
     */
    function distribute(address to, uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        require(to != address(0), "Cannot distribute to zero address");
        require(amount > 0, "Amount must be greater than 0");

        uint256 balance = stormToken.balanceOf(address(this));
        require(balance >= amount, "Insufficient treasury balance");

        totalDistributed += amount;
        stormToken.safeTransfer(to, amount);

        emit TreasuryDistributed(to, amount, totalDistributed);
    }

    /**
     * @dev Batch distribute to multiple recipients.
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts (must match recipients length)
     */
    function distributeBatch(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        uint256 balance = stormToken.balanceOf(address(this));
        require(balance >= totalAmount, "Insufficient treasury balance");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot distribute to zero address");
            require(amounts[i] > 0, "Amount must be greater than 0");

            totalDistributed += amounts[i];
            stormToken.safeTransfer(recipients[i], amounts[i]);

            emit TreasuryDistributed(recipients[i], amounts[i], totalDistributed);
        }
    }

    function remainingPool() external view returns (uint256) {
        return stormToken.balanceOf(address(this));
    }

    /**
     * @dev Emergency withdraw (only admin, for recovery scenarios).
     * @param to Address to send tokens to
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(to != address(0), "Cannot withdraw to zero address");
        stormToken.safeTransfer(to, amount);
        emit EmergencyWithdraw(to, amount);
    }
}
