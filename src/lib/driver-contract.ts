import { ethers } from 'ethers'
import { DriverApplicationData } from '@/components/driver-application/types/driver-application.types'

// Contract ABI - minimal interface for our contract functions
const CONTRACT_ABI = [
  'function submitApplication(string memory _applicationHash) external returns (uint256)',
  'function updateApplication(uint256 _applicationId, string memory _newHash) external',
  'function verifyApplication(uint256 _applicationId) external',
  'function rejectApplication(uint256 _applicationId, string memory _reason) external',
  'function getUserApplications(address _user, uint256 _offset, uint256 _limit) external view returns (uint256[])',
  'function getApplication(uint256 _applicationId) external view returns (tuple(address owner, string applicationHash, bool isVerified, bool isRejected, uint256 timestamp, uint256 lastUpdated, string rejectionReason))',
  'function isHashUsed(string memory _hash) external view returns (bool)',
  'function isApplicationExpired(uint256 _applicationId) external view returns (bool)',
  'event ApplicationSubmitted(uint256 indexed applicationId, address indexed owner, string applicationHash)',
  'event ApplicationVerified(uint256 indexed applicationId, address indexed verifier)',
  'event ApplicationRejected(uint256 indexed applicationId, address indexed verifier, string reason)',
  'event ApplicationUpdated(uint256 indexed applicationId, address indexed owner, string newHash)',
]

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS!

export interface BlockchainApplication {
  owner: string
  applicationHash: string
  isVerified: boolean
  isRejected: boolean
  timestamp: number
  lastUpdated: number
  rejectionReason: string
}

export interface ContractService {
  submitApplication: (applicationHash: string) => Promise<number>
  getUserApplications: (
    userAddress: string,
    offset?: number,
    limit?: number
  ) => Promise<number[]>
  getApplication: (applicationId: number) => Promise<BlockchainApplication>
  isHashUsed: (hash: string) => Promise<boolean>
}

class DriverContractService implements ContractService {
  private contract: ethers.Contract
  private provider: ethers.Provider
  private signer: ethers.Signer | null = null

  constructor() {
    if (typeof window === 'undefined') {
      throw new Error(
        'Contract service can only be used in browser environment'
      )
    }

    // Initialize provider (Base Sepolia)
    this.provider = new ethers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_ALCHEMY_BASE_SEPOLIA_URL ||
        'https://base-sepolia.g.alchemy.com/v2/1EacVcYetgk_QIWCKp4hI'
    )

    // Initialize contract
    this.contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      this.provider
    )
  }

  async connectWallet(): Promise<void> {
    if (!window.ethereum) {
      throw new Error('MetaMask not detected')
    }

    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' })

    // Create signer
    this.signer = new ethers.BrowserProvider(window.ethereum).getSigner()

    // Update contract with signer
    this.contract = this.contract.connect(this.signer)
  }

  async submitApplication(applicationHash: string): Promise<number> {
    if (!this.signer) {
      throw new Error('Wallet not connected')
    }

    console.log('📝 Submitting application to blockchain...')

    try {
      const tx = await this.contract.submitApplication(applicationHash)
      console.log('⏳ Transaction sent:', tx.hash)

      const receipt = await tx.wait()
      console.log('✅ Transaction confirmed:', receipt.hash)

      // Get the application ID from the event
      const event = receipt.logs.find((log) => {
        try {
          const parsed = this.contract.interface.parseLog(log)
          return parsed?.name === 'ApplicationSubmitted'
        } catch {
          return false
        }
      })

      if (event) {
        const parsed = this.contract.interface.parseLog(event)
        const applicationId = parsed?.args.applicationId
        console.log('🎯 Application submitted with ID:', applicationId)
        return Number(applicationId)
      }

      throw new Error('Could not retrieve application ID from transaction')
    } catch (error) {
      console.error('❌ Failed to submit application to blockchain:', error)
      throw error
    }
  }

  async getUserApplications(
    userAddress: string,
    offset: number = 0,
    limit: number = 10
  ): Promise<number[]> {
    try {
      const applications = await this.contract.getUserApplications(
        userAddress,
        offset,
        limit
      )
      return applications.map((id: any) => Number(id))
    } catch (error) {
      console.error('❌ Failed to get user applications:', error)
      throw error
    }
  }

  async getApplication(applicationId: number): Promise<BlockchainApplication> {
    try {
      const app = await this.contract.getApplication(applicationId)
      return {
        owner: app.owner,
        applicationHash: app.applicationHash,
        isVerified: app.isVerified,
        isRejected: app.isRejected,
        timestamp: Number(app.timestamp),
        lastUpdated: Number(app.lastUpdated),
        rejectionReason: app.rejectionReason,
      }
    } catch (error) {
      console.error('❌ Failed to get application:', error)
      throw error
    }
  }

  async isHashUsed(hash: string): Promise<boolean> {
    try {
      return await this.contract.isHashUsed(hash)
    } catch (error) {
      console.error('❌ Failed to check hash usage:', error)
      throw error
    }
  }
}

// Singleton instance
let contractService: DriverContractService | null = null

export function getDriverContractService(): DriverContractService {
  if (!contractService) {
    contractService = new DriverContractService()
  }
  return contractService
}

// Utility function to generate application hash
export function generateApplicationHash(
  applicationData: DriverApplicationData
): string {
  // Create a deterministic hash from the application data
  const dataString = JSON.stringify(
    applicationData,
    Object.keys(applicationData).sort()
  )

  // Use Web Crypto API to generate SHA-256 hash
  const encoder = new TextEncoder()
  const data = encoder.encode(dataString)

  // For now, we'll use a simple hash. In production, you'd want to use crypto.subtle.digest
  // But since it's async, we'll create a synchronous version for simplicity
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data[i]
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return '0x' + Math.abs(hash).toString(16).padStart(8, '0')
}

// Enhanced version using crypto.subtle (async)
export async function generateApplicationHashAsync(
  applicationData: DriverApplicationData
): Promise<string> {
  const dataString = JSON.stringify(
    applicationData,
    Object.keys(applicationData).sort()
  )
  const encoder = new TextEncoder()
  const data = encoder.encode(dataString)

  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return '0x' + hashHex
}

// Upload driver application data to IPFS
export async function uploadDriverApplicationToIPFS(
  applicationData: DriverApplicationData
): Promise<string> {
  try {
    console.log('📤 Uploading driver application to IPFS...')

    // Create a JSON file from the application data
    const jsonData = JSON.stringify(applicationData, null, 2)
    const blob = new Blob([jsonData], { type: 'application/json' })

    // Create FormData for Pinata
    const formData = new FormData()
    formData.append('file', blob, 'driver-application.json')
    formData.append(
      'pinataMetadata',
      JSON.stringify({
        name: 'driver-application',
        keyvalues: {
          type: 'driver-application',
          timestamp: new Date().toISOString(),
        },
      })
    )
    formData.append(
      'pinataOptions',
      JSON.stringify({
        cidVersion: 1,
        wrapWithDirectory: false,
      })
    )

    // Upload to Pinata
    const response = await fetch(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
        },
        body: formData,
      }
    )

    if (!response.ok) {
      throw new Error(`Pinata upload failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ Driver application uploaded to IPFS:', result.IpfsHash)

    return result.IpfsHash
  } catch (error) {
    console.error('❌ Failed to upload driver application to IPFS:', error)
    throw error
  }
}
