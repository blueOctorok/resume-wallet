// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StormToken
 * @dev StormChain ERC20 token with fixed 15M supply.
 * 
 * - Name: "StormChain"
 * - Symbol: "STORM"
 * - Decimals: 18 (standard, supports fractional distribution like BTC satoshis)
 * - Total Supply: 15,000,000 STORM (minted once at deploy, no further minting)
 * - Network: Base only
 * 
 * All 15M tokens are minted to the deployer at construction. The deploy script
 * then distributes them to: RewardDistributor (9M), Treasury (3M), DEX Liquidity (1M),
 * and two FounderVesting contracts (1M each).
 * 
 * Optional Pausable for emergency freeze (only owner can pause/unpause).
 */
contract StormToken is ERC20, Ownable, Pausable {
    // Fixed total supply: 15 million tokens (with 18 decimals)
    uint256 public constant TOTAL_SUPPLY = 15_000_000 * 10**18;

    /**
     * @dev Constructor mints the entire fixed supply to the deployer.
     * No mint function exists after this - supply is permanently fixed.
     */
    constructor() ERC20("StormChain", "STORM") Ownable(msg.sender) {
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    /**
     * @dev Pause all token transfers (emergency only).
     * Only the owner can call this.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers.
     * Only the owner can call this.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Hook that is called before any token transfer.
     * Enforces the pause state.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        require(!paused(), "StormToken: token transfer while paused");
        super._update(from, to, value);
    }
}
