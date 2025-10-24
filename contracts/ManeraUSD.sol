// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ManeraUSD is ERC20, Ownable {
    address public treasury;
    mapping(address => bool) public authorizedMinters;

    constructor(address initialOwner) 
        ERC20("Manera USD", "MUSD") 
        Ownable(initialOwner) 
    {
        treasury = msg.sender;
    }

    function mint(address to, uint256 amount) external onlyAuthorized {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    modifier onlyAuthorized() {
        require(authorizedMinters[msg.sender], "Not authorized");
        _;
    }

    function addMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
    }

    function removeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
    }
}