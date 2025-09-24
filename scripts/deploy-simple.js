require('dotenv').config({ path: '.env.local' })
const { ethers } = require('hardhat')

async function main() {
  console.log('🚀 Simple ResumeRegistry deployment...')

  // Get the deployer account
  const [deployer] = await ethers.getSigners()
  console.log('📝 Deploying with account:', deployer.address)

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH')

  // Get network info
  const network = await ethers.provider.getNetwork()
  console.log(
    '🌐 Network:',
    network.name,
    '(Chain ID:',
    network.chainId.toString(),
    ')'
  )

  try {
    // Deploy the contract with minimal gas settings
    console.log('\n📦 Deploying ResumeRegistry contract...')
    const ResumeRegistry = await ethers.getContractFactory('ResumeRegistry')

    console.log('⏳ Deploying with automatic gas estimation...')
    const resumeRegistry = await ResumeRegistry.deploy()

    console.log('⏳ Waiting for deployment transaction...')
    await resumeRegistry.waitForDeployment()

    const contractAddress = await resumeRegistry.getAddress()
    console.log('✅ ResumeRegistry deployed to:', contractAddress)

    // Test basic functionality
    console.log('\n🧪 Testing basic functionality...')
    const owner = await resumeRegistry.owner()
    const resumeCount = await resumeRegistry.resumeCount()

    console.log('👤 Contract owner:', owner)
    console.log('📊 Initial resume count:', resumeCount.toString())

    console.log('\n🎉 Deployment completed successfully!')
    console.log('📍 Contract Address:', contractAddress)

    return contractAddress
  } catch (error) {
    console.error('\n❌ Deployment failed with detailed error:')
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)

    if (error.receipt) {
      console.error('Transaction receipt:', {
        status: error.receipt.status,
        gasUsed: error.receipt.gasUsed?.toString(),
        contractAddress: error.receipt.contractAddress,
      })
    }

    throw error
  }
}

// Handle errors
main()
  .then((contractAddress) => {
    console.log('\n✅ Simple deployment completed!')
    console.log('📍 Contract Address:', contractAddress)
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Simple deployment failed:')
    console.error(error)
    process.exit(1)
  })
