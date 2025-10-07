const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  console.log('🚀 Starting ProductionDriverRegistry deployment...')

  // Get the contract factory
  const ProductionDriverRegistry = await hre.ethers.getContractFactory(
    'ProductionDriverRegistry'
  )

  console.log('📝 Deploying ProductionDriverRegistry contract...')

  // Deploy the contract
  const driverRegistry = await ProductionDriverRegistry.deploy()

  // Wait for deployment to complete
  await driverRegistry.waitForDeployment()

  const contractAddress = await driverRegistry.getAddress()

  console.log('✅ ProductionDriverRegistry deployed successfully!')
  console.log('📍 Contract Address:', contractAddress)
  console.log('🌐 Network:', hre.network.name)
  console.log(
    '⛽ Gas Used:',
    (await driverRegistry.deploymentTransaction())?.gasLimit?.toString()
  )

  // Update .env.local with contract address
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8')

    // Remove existing DRIVER_APP_CONTRACT_ADDRESS line if it exists
    envContent = envContent.replace(
      /^NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS=.*$/m,
      ''
    )

    // Add new DRIVER_APP_CONTRACT_ADDRESS
    envContent += `\nNEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS=${contractAddress}\n`

    fs.writeFileSync(envPath, envContent)
    console.log('✅ Updated .env.local with DRIVER_APP_CONTRACT_ADDRESS')
  } else {
    console.log('⚠️ .env.local not found - please add manually:')
    console.log(`NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS=${contractAddress}`)
  }

  // Verify contract on BaseScan (if not localhost)
  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    console.log('🔍 Waiting for block confirmations before verification...')
    await driverRegistry.deploymentTransaction()?.wait(6)

    try {
      console.log('🔍 Verifying contract on BaseScan...')
      await hre.run('verify:verify', {
        address: contractAddress,
        constructorArguments: [],
      })
      console.log('✅ Contract verified successfully on BaseScan!')
    } catch (error) {
      console.log('❌ Contract verification failed:', error.message)
    }
  }

  // Save deployment info
  const deploymentInfo = {
    contractAddress,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployedAt: new Date().toISOString(),
    deployer: (await hre.ethers.getSigners())[0].address,
    contractType: 'ProductionDriverRegistry',
    features: [
      'Access Control (Admin, Verifier roles)',
      'Pausable (Emergency stop)',
      'ReentrancyGuard (Security)',
      'Application Updates',
      'Verification & Rejection',
      'Pagination Support',
      'Application Expiry (90 days)',
      'Max Applications per User (10)',
    ],
  }

  console.log('\n📋 Deployment Summary:')
  console.log(JSON.stringify(deploymentInfo, null, 2))

  console.log('\n🎯 Production Features:')
  console.log('✅ Role-based access control (Admin, Verifier)')
  console.log('✅ Emergency pause functionality')
  console.log('✅ Application updates before verification')
  console.log('✅ Verification and rejection system')
  console.log('✅ Pagination for scalability')
  console.log('✅ Application expiry (90 days)')
  console.log('✅ Rate limiting (10 apps per user)')
  console.log('✅ Reentrancy protection')

  console.log('\n🎯 Next Steps:')
  console.log('1. ✅ Production contract address updated in .env.local')
  console.log('2. Set up verifier roles for DOT inspectors')
  console.log('3. Integrate with your driver application form')
  console.log('4. Test all production features')

  return contractAddress
}

// Execute deployment
main()
  .then((address) => {
    console.log(
      `\n🎉 Production Driver Registry deployment completed! Contract address: ${address}`
    )
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  })
