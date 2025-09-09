/**
 * EIP-712 Typed Data utilities for Resume Wallet
 * Provides structured data signing for enhanced security and user experience
 */

export interface TypedDataDomain {
  name: string
  version: string
  chainId: number
  verifyingContract: string
}

export interface SignInMessage {
  user: string
  action: string
  nonce: number
  expiry: number
}

export interface ResumeVerificationMessage {
  resumeId: number
  ipfsHash: string
  verifier: string
  nonce: number
  expiry: number
}

export interface PremiumActivationMessage {
  user: string
  feature: string
  amount: string
  nonce: number
  expiry: number
}

/**
 * Generate a secure nonce for EIP-712 signatures
 */
export const generateNonce = (): number => {
  return Math.floor(Math.random() * 1000000)
}

/**
 * Generate expiry timestamp (1 hour from now)
 */
export const generateExpiry = (): number => {
  return Math.floor(Date.now() / 1000) + 3600
}

/**
 * Create EIP-712 typed data for user authentication
 */
export const createSignInTypedData = (
  userAddress: string
): {
  domain: TypedDataDomain
  types: any
  primaryType: string
  message: SignInMessage
} => {
  const nonce = generateNonce()
  const expiry = generateExpiry()

  return {
    domain: {
      name: 'Resume Wallet',
      version: '1',
      chainId: 8453, // Base Mainnet
      verifyingContract:
        process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
        '0x0000000000000000000000000000000000000000',
    },
    types: {
      SignIn: [
        { name: 'user', type: 'address' },
        { name: 'action', type: 'string' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    },
    primaryType: 'SignIn',
    message: {
      user: userAddress,
      action: 'Sign in to Resume Wallet',
      nonce,
      expiry,
    },
  }
}

/**
 * Create EIP-712 typed data for resume verification
 */
export const createResumeVerificationTypedData = (
  resumeId: number,
  ipfsHash: string,
  verifierAddress: string
): {
  domain: TypedDataDomain
  types: any
  primaryType: string
  message: ResumeVerificationMessage
} => {
  const nonce = generateNonce()
  const expiry = generateExpiry()

  return {
    domain: {
      name: 'Resume Wallet',
      version: '1',
      chainId: 8453, // Base Mainnet
      verifyingContract:
        process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
        '0x0000000000000000000000000000000000000000',
    },
    types: {
      ResumeVerification: [
        { name: 'resumeId', type: 'uint256' },
        { name: 'ipfsHash', type: 'string' },
        { name: 'verifier', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    },
    primaryType: 'ResumeVerification',
    message: {
      resumeId,
      ipfsHash,
      verifier: verifierAddress,
      nonce,
      expiry,
    },
  }
}

/**
 * Create EIP-712 typed data for premium feature activation
 */
export const createPremiumActivationTypedData = (
  userAddress: string,
  feature: string,
  amount: string
): {
  domain: TypedDataDomain
  types: any
  primaryType: string
  message: PremiumActivationMessage
} => {
  const nonce = generateNonce()
  const expiry = generateExpiry()

  return {
    domain: {
      name: 'Resume Wallet',
      version: '1',
      chainId: 8453, // Base Mainnet
      verifyingContract:
        process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
        '0x0000000000000000000000000000000000000000',
    },
    types: {
      PremiumActivation: [
        { name: 'user', type: 'address' },
        { name: 'feature', type: 'string' },
        { name: 'amount', type: 'string' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    },
    primaryType: 'PremiumActivation',
    message: {
      user: userAddress,
      feature,
      amount,
      nonce,
      expiry,
    },
  }
}

/**
 * Sign typed data using Base Account SDK
 */
export const signTypedData = async (
  userAddress: string,
  typedData: any
): Promise<string> => {
  const { baseProvider } = await import('@/lib/base-account-sdk')

  if (!baseProvider) {
    throw new Error('Base provider not initialized')
  }

  const signature = await baseProvider.request({
    method: 'eth_signTypedData_v4',
    params: [userAddress, JSON.stringify(typedData)],
  })

  return signature
}

/**
 * Verify typed data signature on the backend
 */
export const verifyTypedDataSignature = async (
  typedData: any,
  signature: string,
  address: string
): Promise<boolean> => {
  const response = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ typedData, signature, address }),
  })

  if (!response.ok) {
    throw new Error('Signature verification failed')
  }

  const result = await response.json()
  return result.success
}

/**
 * Check if signature is expired
 */
export const isSignatureExpired = (expiry: number): boolean => {
  const now = Math.floor(Date.now() / 1000)
  return expiry < now
}

/**
 * Get time remaining until signature expires
 */
export const getTimeUntilExpiry = (expiry: number): number => {
  const now = Math.floor(Date.now() / 1000)
  return Math.max(0, expiry - now)
}
