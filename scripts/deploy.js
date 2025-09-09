const hre = require('hardhat')

async function main() {
  console.log('🚀 Starting ResumeRegistry deployment...')

  // Get the contract factory
  const ResumeRegistry = await hre.ethers.getContractFactory('ResumeRegistry')

  console.log('📝 Deploying ResumeRegistry contract...')

  // Deploy the contract
  const resumeRegistry = await ResumeRegistry.deploy()

  // Wait for deployment to complete
  await resumeRegistry.waitForDeployment()

  const contractAddress = await resumeRegistry.getAddress()

  console.log('✅ ResumeRegistry deployed successfully!')
  console.log('📍 Contract Address:', contractAddress)
  console.log('🌐 Network:', hre.network.name)
  console.log(
    '⛽ Gas Used:',
    (await resumeRegistry.deploymentTransaction())?.gasLimit?.toString()
  )

  // Verify contract on BaseScan (if not localhost)
  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    console.log('🔍 Waiting for block confirmations before verification...')
    await resumeRegistry.deploymentTransaction()?.wait(6)

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
  }

  console.log('\n📋 Deployment Summary:')
  console.log(JSON.stringify(deploymentInfo, null, 2))

  console.log('\n🎯 Next Steps:')
  console.log('1. Update NEXT_PUBLIC_CONTRACT_ADDRESS in your .env.local')
  console.log('2. Test the contract functions')
  console.log('3. Integrate with your frontend')

  return contractAddress
}

// Execute deployment
main()
  .then((address) => {
    console.log(`\n🎉 Deployment completed! Contract address: ${address}`)
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  })
