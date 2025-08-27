import { PinataSDK } from 'pinata-web3'

// Debug: Log environment variables
console.log('🔍 Environment variables check:')
console.log(
  'NEXT_PUBLIC_PINATA_JWT:',
  process.env.NEXT_PUBLIC_PINATA_JWT ? 'Found' : 'Missing'
)
console.log(
  'NEXT_PUBLIC_PINATA_GATEWAY:',
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ? 'Found' : 'Missing'
)
console.log('JWT Length:', process.env.NEXT_PUBLIC_PINATA_JWT?.length || 0)

// Debug: Log the actual JWT (first 50 chars for security)
console.log(
  '🔍 JWT Preview:',
  process.env.NEXT_PUBLIC_PINATA_JWT?.substring(0, 50) + '...'
)

// Debug: Check JWT format
const jwtParts = process.env.NEXT_PUBLIC_PINATA_JWT?.split('.')
console.log('🔍 JWT Parts:', jwtParts?.length || 0)
if (jwtParts && jwtParts.length !== 3) {
  console.error(
    '❌ JWT has wrong number of parts! Expected 3, got:',
    jwtParts.length
  )
}

const pinata = new PinataSDK({
  pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT!,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY!,
})

export const uploadToIPFS = async (file: File) => {
  try {
    console.log('🔍 Attempting Pinata upload...')
    console.log(
      '🔍 JWT being used:',
      process.env.NEXT_PUBLIC_PINATA_JWT?.substring(0, 50) + '...'
    )

    const upload = await pinata.upload.file(file)
    return {
      ipfsHash: upload.IpfsHash,
      url: `${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${upload.IpfsHash}`,
    }
  } catch (error) {
    console.error('🔍 Pinata upload error:', error)
    throw error
  }
}
