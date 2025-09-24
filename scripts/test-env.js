require('dotenv').config({ path: '.env.local' })

console.log('🔍 Environment Variables Check:')
console.log('Private key loaded:', !!process.env.PRIVATE_KEY)
console.log('Private key length:', process.env.PRIVATE_KEY?.length)
console.log('Alchemy URL loaded:', !!process.env.ALCHEMY_BASE_SEPOLIA_URL)
console.log('Alchemy URL:', process.env.ALCHEMY_BASE_SEPOLIA_URL)

if (process.env.PRIVATE_KEY) {
  console.log('✅ Private key is loaded')
} else {
  console.log('❌ Private key is NOT loaded')
}

if (process.env.ALCHEMY_BASE_SEPOLIA_URL) {
  console.log('✅ Alchemy URL is loaded')
} else {
  console.log('❌ Alchemy URL is NOT loaded')
}
