const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

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

  // Update .env.local with contract address
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8')

    // Remove existing CONTRACT_ADDRESS line if it exists
    envContent = envContent.replace(/^NEXT_PUBLIC_CONTRACT_ADDRESS=.*$/m, '')

    // Add new CONTRACT_ADDRESS
    envContent += `\nNEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}\n`

    fs.writeFileSync(envPath, envContent)
    console.log('✅ Updated .env.local with CONTRACT_ADDRESS')
  } else {
    console.log('⚠️ .env.local not found - please add manually:')
    console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`)
  }

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
  console.log('1. ✅ Contract address updated in .env.local')
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
