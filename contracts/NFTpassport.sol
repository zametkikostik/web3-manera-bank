// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTpassport is ERC721, Ownable {
    uint256 private _nextTokenId;
    mapping(uint256 => bytes32) private _passportHashes;
    mapping(address => bool) public authorizedIssuers;
    mapping(address => uint256) public ownerToTokenId;
    mapping(uint256 => uint8) public verificationStatus; // 0 = pending, 1 = verified, 2 = expired
    enum Tier { Bronze, Silver, Gold, Platinum, Diamond }
    mapping(address => Tier) public userTier;
    
    event PassportUpdated(uint256 tokenId, bytes32 newHash, uint8 status);
    event PassportVerified(uint256 tokenId, address verifiedBy);

    constructor(address initialOwner)
        ERC721("Manera KYC Passport", "MKP")
        Ownable(initialOwner)
    {}

    function safeMint(address to, bytes32 passportHash) external onlyIssuer {
        require(balanceOf(to) == 0, "User already has a passport");
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _passportHashes[tokenId] = passportHash;
        ownerToTokenId[to] = tokenId;
        verificationStatus[tokenId] = 0; // Set status to pending
    }

    function updatePassportHash(uint256 tokenId, bytes32 newHash, bytes memory signature) external {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "Not owner nor approved");
        require(verificationStatus[tokenId] != 2, "Passport expired");
        
        // Verify server signature
        bytes32 messageHash = keccak256(abi.encodePacked(tokenId, newHash));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address signer = recoverSigner(ethSignedMessageHash, signature);
        require(authorizedIssuers[signer], "Invalid signature");
        
        _passportHashes[tokenId] = newHash;
        verificationStatus[tokenId] = 0; // Reset to pending after update
        emit PassportUpdated(tokenId, newHash, 0);
    }

    function verifyPassport(uint256 tokenId, address verifier) external onlyIssuer {
        verificationStatus[tokenId] = 1;
        emit PassportVerified(tokenId, verifier);
    }

    function expirePassport(uint256 tokenId) external onlyIssuer {
        verificationStatus[tokenId] = 2;
        emit PassportUpdated(tokenId, _passportHashes[tokenId], 2);
    }

    function getPassportHash(uint256 tokenId) external view returns (bytes32) {
        require(_exists(tokenId), "Token does not exist");
        return _passportHashes[tokenId];
    }

    function getVerificationStatus(uint256 tokenId) external view returns (uint8) {
        require(_exists(tokenId), "Token does not exist");
        return verificationStatus[tokenId];
    }

    function addIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
    }

    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature) private pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig) private pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Not authorized issuer");
        _;
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
        require(from == address(0) || to == address(0), "Soulbound token: Transfer not allowed");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}