/**
 * Script to update maxApplicationsPerUser limit in ProductionDriverRegistry
 * 
 * Usage:
 *   npx hardhat run scripts/update-max-apps-limit.js --network baseSepolia
 * 
 * Make sure you have:
 *   1. ADMIN_ROLE on the contract
 *   2. PRIVATE_KEY set in .env.local (your admin wallet)
 *   3. Contract address in NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS
 */

const hre = require('hardhat')
require('dotenv').config({ path: '.env.local' })

async function main() {
  const contractAddress = process.env.NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS

  if (!contractAddress) {
    throw new Error('❌ NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS not set in .env.local')
  }

  // High limit for testing - change this for production!
  const newLimit = 100000 // 100k for testing, lower in production

  console.log('🔧 Updating maxApplicationsPerUser limit...')
  console.log('📍 Contract Address:', contractAddress)
  console.log('🔢 New Limit:', newLimit)
  console.log('🌐 Network:', hre.network.name)

  // Get the contract
  const ProductionDriverRegistry = await hre.ethers.getContractFactory(
    'ProductionDriverRegistry'
  )
  const contract = ProductionDriverRegistry.attach(contractAddress)

  // Check current limit
  const currentLimit = await contract.maxApplicationsPerUser()
  console.log('📊 Current Limit:', currentLimit.toString())

  // Get the signer (should be admin)
  const [signer] = await hre.ethers.getSigners()
  console.log('👤 Signer:', signer.address)

  // Check if signer has ADMIN_ROLE
  const ADMIN_ROLE = await contract.ADMIN_ROLE()
  const hasAdminRole = await contract.hasRole(ADMIN_ROLE, signer.address)
  
  if (!hasAdminRole) {
    throw new Error('❌ Signer does not have ADMIN_ROLE. Cannot update limit.')
  }

  console.log('✅ Signer has ADMIN_ROLE')

  // Update the limit
  console.log('\n📝 Calling setMaxApplicationsPerUser...')
  const tx = await contract.setMaxApplicationsPerUser(newLimit)
  console.log('⏳ Transaction Hash:', tx.hash)
  console.log('⏳ Waiting for confirmation...')

  const receipt = await tx.wait()
  console.log('✅ Transaction confirmed!')
  console.log('📦 Block Number:', receipt.blockNumber)

  // Wait a moment for state to propagate
  console.log('⏳ Waiting for state to propagate...')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Verify the new limit
  const updatedLimit = await contract.maxApplicationsPerUser()
  console.log('\n✅ Limit updated successfully!')
  console.log('📊 New Limit:', updatedLimit.toString())

  console.log('\n🎯 Summary:')
  console.log(`   Old Limit: ${currentLimit.toString()}`)
  console.log(`   New Limit: ${updatedLimit.toString()}`)
  console.log(`   Transaction: ${tx.hash}`)
  console.log(`   View on BaseScan: https://sepolia.basescan.org/tx/${tx.hash}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
