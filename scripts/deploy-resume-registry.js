const { ethers } = require('hardhat')

async function main() {
  console.log('🚀 Starting ResumeRegistry deployment...')

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

  // Deploy the contract
  console.log('\n📦 Deploying ResumeRegistry contract...')
  const ResumeRegistry = await ethers.getContractFactory('ResumeRegistry')

  // Estimate gas
  const deploymentData = ResumeRegistry.interface.encodeDeploy([])
  const gasEstimate = await ethers.provider.estimateGas({
    data: deploymentData,
  })
  console.log('⛽ Estimated gas:', gasEstimate.toString())

  // Deploy with proper gas limit (minimum 400,000 for Base Sepolia)
  const gasLimit = gasEstimate > 200000n ? (gasEstimate * 150n) / 100n : 500000n
  console.log('⛽ Using gas limit:', gasLimit.toString())

  const resumeRegistry = await ResumeRegistry.deploy({
    gasLimit: gasLimit,
  })

  console.log('⏳ Waiting for deployment transaction...')
  await resumeRegistry.waitForDeployment()

  const contractAddress = await resumeRegistry.getAddress()
  console.log('✅ ResumeRegistry deployed to:', contractAddress)

  // Verify deployment
  console.log('\n🔍 Verifying deployment...')
  const owner = await resumeRegistry.owner()
  const resumeCount = await resumeRegistry.resumeCount()

  console.log('👤 Contract owner:', owner)
  console.log('📊 Initial resume count:', resumeCount.toString())

  // Check roles
  const DEFAULT_ADMIN_ROLE = await resumeRegistry.DEFAULT_ADMIN_ROLE()
  const ADMIN_ROLE = await resumeRegistry.ADMIN_ROLE()
  const VERIFIER_ROLE = await resumeRegistry.VERIFIER_ROLE()

  const hasAdminRole = await resumeRegistry.hasRole(
    DEFAULT_ADMIN_ROLE,
    deployer.address
  )
  const hasVerifierRole = await resumeRegistry.hasRole(
    VERIFIER_ROLE,
    deployer.address
  )

  console.log('🔐 Deployer has admin role:', hasAdminRole)
  console.log('✅ Deployer has verifier role:', hasVerifierRole)

  // Test basic functionality
  console.log('\n🧪 Testing basic functionality...')
  try {
    const isVerifier = await resumeRegistry.isVerifier(deployer.address)
    const isAdmin = await resumeRegistry.isAdmin(deployer.address)
    console.log('🔍 Is deployer a verifier?', isVerifier)
    console.log('🔍 Is deployer an admin?', isAdmin)

    console.log('✅ Contract deployed and verified successfully!')
  } catch (error) {
    console.error('❌ Error testing contract:', error.message)
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    deployer: deployer.address,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    gasUsed: gasEstimate.toString(),
  }

  console.log('\n📋 Deployment Summary:')
  console.log(JSON.stringify(deploymentInfo, null, 2))

  // Instructions for next steps
  console.log('\n📝 Next Steps:')
  console.log('1. Add contract address to your .env.local file:')
  console.log(`   NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS=${contractAddress}`)
  console.log('2. Verify contract on BaseScan (if on testnet):')
  console.log(`   npx hardhat verify --network baseSepolia ${contractAddress}`)
  console.log('3. Test contract interaction with your frontend')

  return contractAddress
}

// Handle errors
main()
  .then((contractAddress) => {
    console.log('\n🎉 Deployment completed successfully!')
    console.log('📍 Contract Address:', contractAddress)
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:')
    console.error(error)
    process.exit(1)
  })
