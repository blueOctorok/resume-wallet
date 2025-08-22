// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ResumeRegistry {
    struct Resume {
        address owner;
        string ipfsHash;
        bool isPublic;
        uint256 timestamp;
    }
    
    mapping(uint256 => Resume) public resumes;
    mapping(address => uint256[]) public userResumes;
    uint256 public resumeCount;
    
    event ResumeAdded(uint256 indexed resumeId, address indexed owner, string ipfsHash);
    
    function addResume(string memory _ipfsHash, bool _isPublic) external returns (uint256) {
        resumeCount++;
        resumes[resumeCount] = Resume(msg.sender, _ipfsHash, _isPublic, block.timestamp);
        userResumes[msg.sender].push(resumeCount);
        
        emit ResumeAdded(resumeCount, msg.sender, _ipfsHash);
        return resumeCount;
    }
    
    function getUserResumes(address _user) external view returns (uint256[] memory) {
        return userResumes[_user];
    }
}   