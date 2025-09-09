/**
 * ResumeRegistry Contract Configuration
 * Centralized contract address and ABI management
 */

// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  // Base Networks
  base: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '',
  baseSepolia: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '',

  // Local development
  hardhat: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Default Hardhat address
  localhost: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
} as const

// ResumeRegistry ABI (minimal for frontend)
export const RESUME_REGISTRY_ABI = [
  // Events
  'event ResumeAdded(uint256 indexed resumeId, address indexed owner, string ipfsHash, string title)',
  'event ResumeUpdated(uint256 indexed resumeId, address indexed owner, string newIpfsHash)',
  'event ResumeVerified(uint256 indexed resumeId, address indexed verifier, bool verified)',

  // View functions
  'function resumeCount() view returns (uint256)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function resumes(uint256) view returns (address owner, string ipfsHash, string title, string filename, bool isPublic, bool isVerified, uint256 timestamp, uint256 lastUpdated)',
  'function getUserResumes(address) view returns (uint256[])',
  'function getResume(uint256) view returns (tuple(address owner, string ipfsHash, string title, string filename, bool isPublic, bool isVerified, uint256 timestamp, uint256 lastUpdated))',
  'function getVerification(uint256) view returns (tuple(address verifier, bool verified, string verificationHash, uint256 timestamp, string notes))',
  'function getPublicResumes() view returns (uint256[])',
  'function isVerifier(address) view returns (bool)',
  'function isAdmin(address) view returns (bool)',
  'function hasRole(bytes32, address) view returns (bool)',

  // Write functions
  'function addResume(string memory _ipfsHash, string memory _title, string memory _filename, bool _isPublic) returns (uint256)',
  'function updateResume(uint256 _resumeId, string memory _newIpfsHash, string memory _newTitle, bool _isPublic)',
  'function verifyResume(uint256 _resumeId, bool _verified, string memory _verificationHash, string memory _notes)',

  // Admin functions
  'function addVerifier(address _verifier)',
  'function removeVerifier(address _verifier)',
  'function pause()',
  'function unpause()',
  'function grantRole(bytes32 role, address account)',
  'function revokeRole(bytes32 role, address account)',
] as const

/**
 * Get contract address for current network
 */
export function getContractAddress(chainId?: number): string {
  switch (chainId) {
    case 8453: // Base Mainnet
      return CONTRACT_ADDRESSES.base
    case 84532: // Base Sepolia
      return CONTRACT_ADDRESSES.baseSepolia
    case 1337: // Hardhat
      return CONTRACT_ADDRESSES.hardhat
    default:
      return CONTRACT_ADDRESSES.baseSepolia // Default to testnet
  }
}

/**
 * Check if contract is deployed for current network
 */
export function isContractDeployed(chainId?: number): boolean {
  const address = getContractAddress(chainId)
  return address !== '' && address !== '0x...'
}

/**
 * Get contract configuration for current network
 */
export function getContractConfig(chainId?: number) {
  return {
    address: getContractAddress(chainId),
    abi: RESUME_REGISTRY_ABI,
    isDeployed: isContractDeployed(chainId),
  }
}
