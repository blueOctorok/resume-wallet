// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ResumeRegistry
 * @dev A smart contract for storing and verifying resumes on the blockchain
 * @author DriverAppChain
 */
contract ResumeRegistry is Ownable, Pausable, ReentrancyGuard, AccessControl {
    struct Resume {
        address owner;
        string ipfsHash;
        string title;
        string filename;
        bool isPublic;
        bool isVerified;
        uint256 timestamp;
        uint256 lastUpdated;
    }
    
    struct Verification {
        address verifier;
        bool verified;
        string verificationHash;
        uint256 timestamp;
        string notes;
    }
    
    // Roles
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // State variables
    mapping(uint256 => Resume) public resumes;
    mapping(address => uint256[]) public userResumes;
    mapping(uint256 => Verification) public verifications;
    mapping(string => bool) public usedIpfsHashes;
    
    uint256 public resumeCount;
    
    // Events
    event ResumeAdded(
        uint256 indexed resumeId, 
        address indexed owner, 
        string ipfsHash, 
        string title
    );
    
    event ResumeUpdated(
        uint256 indexed resumeId, 
        address indexed owner, 
        string newIpfsHash
    );
    
    event ResumeVerified(
        uint256 indexed resumeId, 
        address indexed verifier, 
        bool verified
    );
    
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    
    // Modifiers
    modifier resumeExists(uint256 _resumeId) {
        require(_resumeId > 0 && _resumeId <= resumeCount, "Resume does not exist");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender); // Owner is also a verifier
    }
    
    /**
     * @dev Add a new resume to the registry
     * @param _ipfsHash IPFS hash of the resume file
     * @param _title Title of the resume
     * @param _filename Original filename
     * @param _isPublic Whether the resume is public
     * @return resumeId The ID of the created resume
     */
    function addResume(
        string memory _ipfsHash,
        string memory _title,
        string memory _filename,
        bool _isPublic
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(!usedIpfsHashes[_ipfsHash], "IPFS hash already used");
        
        resumeCount++;
        uint256 resumeId = resumeCount;
        
        resumes[resumeId] = Resume({
            owner: msg.sender,
            ipfsHash: _ipfsHash,
            title: _title,
            filename: _filename,
            isPublic: _isPublic,
            isVerified: false,
            timestamp: block.timestamp,
            lastUpdated: block.timestamp
        });
        
        userResumes[msg.sender].push(resumeId);
        usedIpfsHashes[_ipfsHash] = true;
        
        emit ResumeAdded(resumeId, msg.sender, _ipfsHash, _title);
        return resumeId;
    }
    
    /**
     * @dev Update an existing resume
     * @param _resumeId ID of the resume to update
     * @param _newIpfsHash New IPFS hash
     * @param _newTitle New title
     * @param _isPublic New public status
     */
    function updateResume(
        uint256 _resumeId,
        string memory _newIpfsHash,
        string memory _newTitle,
        bool _isPublic
    ) external whenNotPaused nonReentrant resumeExists(_resumeId) {
        Resume storage resume = resumes[_resumeId];
        require(resume.owner == msg.sender, "Only resume owner can update");
        require(bytes(_newIpfsHash).length > 0, "IPFS hash cannot be empty");
        require(bytes(_newTitle).length > 0, "Title cannot be empty");
        require(!usedIpfsHashes[_newIpfsHash], "IPFS hash already used");
        
        // Remove old hash from used hashes
        usedIpfsHashes[resume.ipfsHash] = false;
        
        // Update resume
        resume.ipfsHash = _newIpfsHash;
        resume.title = _newTitle;
        resume.isPublic = _isPublic;
        resume.isVerified = false; // Reset verification status
        resume.lastUpdated = block.timestamp;
        
        // Add new hash to used hashes
        usedIpfsHashes[_newIpfsHash] = true;
        
        emit ResumeUpdated(_resumeId, msg.sender, _newIpfsHash);
    }
    
    /**
     * @dev Verify a resume
     * @param _resumeId ID of the resume to verify
     * @param _verified Whether the resume is verified
     * @param _verificationHash Hash of verification data
     * @param _notes Verification notes
     */
    function verifyResume(
        uint256 _resumeId,
        bool _verified,
        string memory _verificationHash,
        string memory _notes
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused nonReentrant resumeExists(_resumeId) {
        Resume storage resume = resumes[_resumeId];
        
        verifications[_resumeId] = Verification({
            verifier: msg.sender,
            verified: _verified,
            verificationHash: _verificationHash,
            timestamp: block.timestamp,
            notes: _notes
        });
        
        resume.isVerified = _verified;
        
        emit ResumeVerified(_resumeId, msg.sender, _verified);
    }
    
    /**
     * @dev Get all resumes for a user
     * @param _user User address
     * @return Array of resume IDs
     */
    function getUserResumes(address _user) external view returns (uint256[] memory) {
        return userResumes[_user];
    }
    
    /**
     * @dev Get resume details
     * @param _resumeId Resume ID
     * @return Resume struct
     */
    function getResume(uint256 _resumeId) external view resumeExists(_resumeId) returns (Resume memory) {
        return resumes[_resumeId];
    }
    
    /**
     * @dev Get verification details
     * @param _resumeId Resume ID
     * @return Verification struct
     */
    function getVerification(uint256 _resumeId) external view resumeExists(_resumeId) returns (Verification memory) {
        return verifications[_resumeId];
    }
    
    /**
     * @dev Get all public resumes
     * @return Array of resume IDs that are public
     */
    function getPublicResumes() external view returns (uint256[] memory) {
        uint256[] memory publicResumes = new uint256[](resumeCount);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= resumeCount; i++) {
            if (resumes[i].isPublic) {
                publicResumes[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = publicResumes[i];
        }
        
        return result;
    }
    
    // Admin functions
    function addVerifier(address _verifier) external onlyRole(ADMIN_ROLE) {
        _grantRole(VERIFIER_ROLE, _verifier);
        emit VerifierAdded(_verifier);
    }
    
    function removeVerifier(address _verifier) external onlyRole(ADMIN_ROLE) {
        _revokeRole(VERIFIER_ROLE, _verifier);
        emit VerifierRemoved(_verifier);
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    // Additional utility functions
    function isVerifier(address _account) external view returns (bool) {
        return hasRole(VERIFIER_ROLE, _account);
    }
    
    function isAdmin(address _account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, _account);
    }
}   