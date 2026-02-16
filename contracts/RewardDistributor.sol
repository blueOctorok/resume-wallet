// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RewardDistributor
 * @dev Holds the 9M STORM user-reward pool and distributes tokens to users.
 * 
 * The decay formula (tokens per USDC spent) is computed OFF-CHAIN by the backend.
 * This contract only performs the approved transfer when the backend calls distribute().
 * 
 * Security:
 * - Only addresses with DISTRIBUTOR_ROLE can call distribute()
 * - ReentrancyGuard prevents reentrancy attacks
 * - SafeERC20 for safe token transfers
 * - Tracks total distributed for transparency
 */
contract RewardDistributor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Role that can distribute rewards (assigned to backend/ops wallet)
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    // The STORM token contract
    IERC20 public immutable stormToken;

    // Track total tokens distributed (for transparency and off-chain decay calculation)
    uint256 public totalDistributed;

    // Events
    event RewardDistributed(address indexed recipient, uint256 amount, uint256 totalDistributedAfter);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    /**
     * @dev Constructor sets the STORM token address and grants roles to deployer.
     * @param _stormToken Address of the StormToken contract
     */
    constructor(address _stormToken) {
        require(_stormToken != address(0), "Invalid token address");
        stormToken = IERC20(_stormToken);

        // Deployer gets admin role (can grant/revoke DISTRIBUTOR_ROLE)
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // Deployer also gets distributor role initially (can be transferred later)
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
    }

    /**
     * @dev Distribute STORM tokens to a recipient.
     * Called by the backend after computing the reward amount from USDC spent.
     * 
     * @param to Recipient address (user who earned the reward)
     * @param amount Amount of STORM tokens in wei (18 decimals)
     * 
     * Example: to send 0.44 STORM, pass amount = 440000000000000000 (0.44 * 10^18)
     */
    function distribute(address to, uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        require(to != address(0), "Cannot distribute to zero address");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 balance = stormToken.balanceOf(address(this));
        require(balance >= amount, "Insufficient reward pool balance");

        totalDistributed += amount;
        stormToken.safeTransfer(to, amount);

        emit RewardDistributed(to, amount, totalDistributed);
    }

    /**
     * @dev Batch distribute to multiple recipients (gas efficient for airdrops).
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
        require(balance >= totalAmount, "Insufficient reward pool balance");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot distribute to zero address");
            require(amounts[i] > 0, "Amount must be greater than 0");

            totalDistributed += amounts[i];
            stormToken.safeTransfer(recipients[i], amounts[i]);

            emit RewardDistributed(recipients[i], amounts[i], totalDistributed);
        }
    }

    /**
     * @dev Returns the remaining balance in the reward pool.
     */
    function remainingPool() external view returns (uint256) {
        return stormToken.balanceOf(address(this));
    }

    /**
     * @dev Emergency withdraw function (only admin, for recovery scenarios).
     * Should only be used if there's a critical issue requiring fund recovery.
     * @param to Address to send tokens to
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(to != address(0), "Cannot withdraw to zero address");
        stormToken.safeTransfer(to, amount);
        emit EmergencyWithdraw(to, amount);
    }
}
