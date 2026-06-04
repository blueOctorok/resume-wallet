// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProductionDriverRegistry
 * @dev Production-ready driver application registry with proper security
 */
contract ProductionDriverRegistry is AccessControl, Pausable, ReentrancyGuard {
    struct Application {
        address owner;
        string applicationHash;
        bool isVerified;
        bool isRejected;
        uint256 timestamp;
        uint256 lastUpdated;
        string rejectionReason;
    }
    
    // Roles
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    
    // State
    mapping(uint256 => Application) public applications;
    mapping(address => uint256[]) public userApplications;
    mapping(string => bool) public usedHashes;
    
    uint256 public applicationCount;
    // Configurable limits (were constants before). Initialized in constructor.
    uint256 public maxApplicationsPerUser;
    uint256 public applicationExpiryDays;
    
    // Events
    event ApplicationSubmitted(uint256 indexed applicationId, address indexed owner, string applicationHash);
    event ApplicationVerified(uint256 indexed applicationId, address indexed verifier);
    event ApplicationRejected(uint256 indexed applicationId, address indexed verifier, string reason);
    event ApplicationUpdated(uint256 indexed applicationId, address indexed owner, string newHash);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);

        // Defaults: increased for testing; can be changed later by admin
        maxApplicationsPerUser = 1000;
        applicationExpiryDays = 90;
    }
    
    function submitApplication(string memory _applicationHash) 
        external 
        whenNotPaused 
        nonReentrant 
        returns (uint256) 
    {
        require(bytes(_applicationHash).length > 0, "Hash required");
        require(!usedHashes[_applicationHash], "Hash used");
        require(userApplications[msg.sender].length < maxApplicationsPerUser, "Max apps reached");
        
        applicationCount++;
        uint256 applicationId = applicationCount;
        
        applications[applicationId] = Application({
            owner: msg.sender,
            applicationHash: _applicationHash,
            isVerified: false,
            isRejected: false,
            timestamp: block.timestamp,
            lastUpdated: block.timestamp,
            rejectionReason: ""
        });
        
        userApplications[msg.sender].push(applicationId);
        usedHashes[_applicationHash] = true;
        
        emit ApplicationSubmitted(applicationId, msg.sender, _applicationHash);
        return applicationId;
    }

    /**
     * @notice Relayed submission that credits the application to a specific user address
     * @dev Callable only by RELAYER_ROLE (e.g., a server/relayer)
     */
    function submitApplicationFor(address _user, string memory _applicationHash)
        external
        whenNotPaused
        nonReentrant
        onlyRole(RELAYER_ROLE)
        returns (uint256)
    {
        require(_user != address(0), "User required");
        require(bytes(_applicationHash).length > 0, "Hash required");
        require(!usedHashes[_applicationHash], "Hash used");
        require(userApplications[_user].length < maxApplicationsPerUser, "Max apps reached");

        applicationCount++;
        uint256 applicationId = applicationCount;

        applications[applicationId] = Application({
            owner: _user,
            applicationHash: _applicationHash,
            isVerified: false,
            isRejected: false,
            timestamp: block.timestamp,
            lastUpdated: block.timestamp,
            rejectionReason: ""
        });

        userApplications[_user].push(applicationId);
        usedHashes[_applicationHash] = true;

        emit ApplicationSubmitted(applicationId, _user, _applicationHash);
        return applicationId;
    }
    
    function updateApplication(uint256 _applicationId, string memory _newHash) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(_applicationId > 0 && _applicationId <= applicationCount, "Not exist");
        require(bytes(_newHash).length > 0, "Hash required");
        require(!usedHashes[_newHash], "Hash used");
        
        Application storage app = applications[_applicationId];
        require(app.owner == msg.sender, "Not owner");
        require(!app.isVerified, "Already verified");
        require(!app.isRejected, "Already rejected");
        require(!_isApplicationExpired(app), "Application expired");
        
        // Free up old hash
        usedHashes[app.applicationHash] = false;
        
        // Update application
        app.applicationHash = _newHash;
        app.lastUpdated = block.timestamp;
        app.isRejected = false;
        app.rejectionReason = "";
        
        usedHashes[_newHash] = true;
        
        emit ApplicationUpdated(_applicationId, msg.sender, _newHash);
    }
    
    function verifyApplication(uint256 _applicationId) 
        external 
        onlyRole(VERIFIER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(_applicationId > 0 && _applicationId <= applicationCount, "Not exist");
        
        Application storage app = applications[_applicationId];
        require(!app.isVerified, "Already verified");
        require(!app.isRejected, "Already rejected");
        require(!_isApplicationExpired(app), "Application expired");
        
        app.isVerified = true;
        app.lastUpdated = block.timestamp;
        
        emit ApplicationVerified(_applicationId, msg.sender);
    }
    
    function rejectApplication(uint256 _applicationId, string memory _reason) 
        external 
        onlyRole(VERIFIER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(_applicationId > 0 && _applicationId <= applicationCount, "Not exist");
        require(bytes(_reason).length > 0, "Reason required");
        
        Application storage app = applications[_applicationId];
        require(!app.isVerified, "Already verified");
        require(!app.isRejected, "Already rejected");
        
        app.isRejected = true;
        app.rejectionReason = _reason;
        app.lastUpdated = block.timestamp;
        
        emit ApplicationRejected(_applicationId, msg.sender, _reason);
    }
    
    // View functions with pagination
    function getUserApplications(address _user, uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory userApps = userApplications[_user];
        uint256 length = userApps.length;
        
        if (_offset >= length) {
            return new uint256[](0);
        }
        
        uint256 end = _offset + _limit;
        if (end > length) {
            end = length;
        }
        
        uint256[] memory result = new uint256[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            result[i - _offset] = userApps[i];
        }
        
        return result;
    }
    
    function getApplicationsByStatus(bool _verified, uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory result = new uint256[](_limit);
        uint256 count = 0;
        uint256 processed = 0;
        
        for (uint256 i = 1; i <= applicationCount && count < _limit; i++) {
            if (applications[i].isVerified == _verified && !applications[i].isRejected) {
                if (processed >= _offset) {
                    result[count] = i;
                    count++;
                }
                processed++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory finalResult = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            finalResult[i] = result[i];
        }
        
        return finalResult;
    }
    
    function getApplication(uint256 _applicationId) external view returns (Application memory) {
        require(_applicationId > 0 && _applicationId <= applicationCount, "Not exist");
        return applications[_applicationId];
    }
    
    function isHashUsed(string memory _hash) external view returns (bool) {
        return usedHashes[_hash];
    }
    
    function isApplicationExpired(uint256 _applicationId) external view returns (bool) {
        require(_applicationId > 0 && _applicationId <= applicationCount, "Not exist");
        return _isApplicationExpired(applications[_applicationId]);
    }
    
    // Admin functions
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    function addVerifier(address _verifier) external onlyRole(ADMIN_ROLE) {
        _grantRole(VERIFIER_ROLE, _verifier);
    }
    
    function removeVerifier(address _verifier) external onlyRole(ADMIN_ROLE) {
        _revokeRole(VERIFIER_ROLE, _verifier);
    }
    
    // Internal functions
    function _isApplicationExpired(Application memory _app) internal view returns (bool) {
        return block.timestamp > _app.timestamp + (applicationExpiryDays * 1 days);
    }

    // Admin configuration functions
    function setMaxApplicationsPerUser(uint256 _max) external onlyRole(ADMIN_ROLE) {
        require(_max > 0, "Invalid max");
        maxApplicationsPerUser = _max;
    }

    function setApplicationExpiryDays(uint256 _days) external onlyRole(ADMIN_ROLE) {
        require(_days > 0, "Invalid days");
        applicationExpiryDays = _days;
    }

    // Convenience view helpers
    function getUserApplicationsCount(address _user) external view returns (uint256) {
        return userApplications[_user].length;
    }
}
