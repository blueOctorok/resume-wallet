/**
 * Shared on-chain registration for a resume IPFS hash (ResumeRegistry.addResume).
 * Used by built-resume verify flow and uploaded-PDF verify flow.
 */

import { ethers } from 'ethers'

const RESUME_REGISTRY_ABI = [
  'function addResume(string memory _ipfsHash, string memory _title, string memory _filename, bool _isPublic) external returns (uint256)',
  'function resumeCount() external view returns (uint256)',
] as const

export interface AddResumeOnChainResult {
  txHash: string
  blockchainResumeId: string
  explorerUrl: string
  blockNumber: number
  gasUsed: string
}

export async function addResumeOnChain(params: {
  ipfsHash: string
  title: string
  filename: string
  isPublic: boolean
}): Promise<AddResumeOnChainResult> {
  const contractAddress = process.env.NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS
  const rpcUrl = process.env.ALCHEMY_BASE_SEPOLIA_URL
  const privateKey = process.env.PRIVATE_KEY

  if (!contractAddress || !rpcUrl || !privateKey) {
    throw new Error('RESUME_REGISTRY_NOT_CONFIGURED')
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const signer = new ethers.Wallet(privateKey, provider)
  const contract = new ethers.Contract(contractAddress, RESUME_REGISTRY_ABI, signer)

  const currentCount = await contract.resumeCount()
  const newResumeId = currentCount + BigInt(1)

  const tx = await contract.addResume(
    params.ipfsHash,
    params.title,
    params.filename,
    params.isPublic,
  )

  const receipt = await tx.wait()
  if (!receipt) {
    throw new Error('Transaction receipt missing')
  }

  return {
    txHash: tx.hash,
    blockchainResumeId: newResumeId.toString(),
    explorerUrl: `https://sepolia.basescan.org/tx/${tx.hash}`,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  }
}
