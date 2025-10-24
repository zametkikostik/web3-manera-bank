// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury is Ownable {
    struct Asset {
        address tokenAddress;
        uint256 amount;
    }
    
    Asset[] public lockedAssets;
    address public coldStorage;
    bool public fundsLocked = true;

    constructor(address initialOwner) Ownable(initialOwner) {
        coldStorage = msg.sender;
    }

    function lockFunds(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        lockedAssets.push(Asset(token, amount));
    }

    // Funds can never be withdrawn - permanent lock
    function emergencyWithdraw() external view onlyOwner {
        require(false, "Funds are permanently locked");
    }

    function getTotalValue() external view returns (uint256 total) {
        for (uint i = 0; i < lockedAssets.length; i++) {
            total += lockedAssets[i].amount;
        }
    }
}