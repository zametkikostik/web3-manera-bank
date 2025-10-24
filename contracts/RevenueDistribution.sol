// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RevenueDistribution is Ownable {
    IERC721 public nftContract;
    IERC20 public rewardToken;
    uint256 public totalRewards;
    uint256 public distributionDate;
    
    mapping(uint256 => uint256) public rewardsPerNFT;
    mapping(uint256 => bool) public claimed;

    constructor(
        address _nftContract,
        address _rewardToken,
        address initialOwner
    ) Ownable(initialOwner) {
        nftContract = IERC721(_nftContract);
        rewardToken = IERC20(_rewardToken);
    }

    function depositRewards(uint256 amount) external onlyOwner {
        require(rewardToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        uint256 fee = (amount * platformFee) / 10000;
        uint256 distributedAmount = amount - fee;
        
        if (fee > 0) {
            require(rewardToken.transfer(platformWallet, fee), "Fee transfer failed");
        }
        
        totalRewards += distributedAmount;
        uint256 totalNFTs = nftContract.totalSupply();
        require(totalNFTs > 0, "No NFTs minted");
        
        uint256 rewardPerNFT = distributedAmount / totalNFTs;
        distributionDate = block.timestamp;
        
        for (uint256 i = 0; i < totalNFTs; i++) {
            rewardsPerNFT[i] += rewardPerNFT;
        }
    }

    function claimRewards(uint256 tokenId) external {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(!claimed[tokenId], "Already claimed");
        require(rewardsPerNFT[tokenId] > 0, "No rewards available");
        
        uint256 amount = rewardsPerNFT[tokenId];
        claimed[tokenId] = true;
        require(rewardToken.transfer(msg.sender, amount), "Transfer failed");
    