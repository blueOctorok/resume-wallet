const { ethers } = require('hardhat')

async function main() {
  const contractAddress = process.env.NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS

  console.log('📝 Checking contract at:', contractAddress)

  const ProductionDriverRegistry = await ethers.getContractAt(
    'ProductionDriverRegistry',
    contractAddress
  )

  // Check if paused
  const isPaused = await ProductionDriverRegistry.paused()
  console.log('⏸️  Contract paused:', isPaused)

  // Check owner
  const owner = await ProductionDriverRegistry.owner()
  console.log('👤 Contract owner:', owner)

  // Check deployer address
  const [deployer] = await ethers.getSigners()
  console.log('🔑 Deployer address:', deployer.address)

  // Check if deployer is owner
  console.log(
    '✅ Deployer is owner:',
    owner.toLowerCase() === deployer.address.toLowerCase()
  )

  // Try to check if hash is already used (test with a sample hash)
  const testHash =
    '0x9ea3bf73da5cac5e51ea865eb95057016f88b5d0b472c5f5a8a27b16f25860fb'
  const isUsed = await ProductionDriverRegistry.isHashUsed(testHash)
  console.log('🔍 Test hash already used:', isUsed)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
