const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  console.log('🚀 Starting deployment of all contracts...')

  const contracts = []
  const signer = (await hre.ethers.getSigners())[0]

  console.log('👤 Deployer:', signer.address)
  console.log(
    '💰 Balance:',
    hre.ethers.formatEther(await signer.provider.getBalance(signer.address)),
    'ETH'
  )

  // 1. Deploy ResumeRegistry
  console.log('\n📝 Deploying ResumeRegistry contract...')
  const ResumeRegistry = await hre.ethers.getContractFactory('ResumeRegistry')
  const resumeRegistry = await ResumeRegistry.deploy()
  await resumeRegistry.waitForDeployment()
  const resumeRegistryAddress = await resumeRegistry.getAddress()

  console.log('✅ ResumeRegistry deployed!')
  console.log('📍 Address:', resumeRegistryAddress)
  console.log(
    '⛽ Gas Used:',
    (await resumeRegistry.deploymentTransaction())?.gasLimit?.toString()
  )

  contracts.push({
    name: 'ResumeRegistry',
    address: resumeRegistryAddress,
    gasUsed: (
      await resumeRegistry.deploymentTransaction()
    )?.gasLimit?.toString(),
  })

  // 2. Deploy DriverApplicationRegistry
  console.log('\n📝 Deploying DriverApplicationRegistry contract...')
  const DriverApplicationRegistry = await hre.ethers.getContractFactory(
    'DriverApplicationRegistry'
  )
  const driverAppRegistry = await DriverApplicationRegistry.deploy()
  await driverAppRegistry.waitForDeployment()
  const driverAppRegistryAddress = await driverAppRegistry.getAddress()

  console.log('✅ DriverApplicationRegistry deployed!')
  console.log('📍 Address:', driverAppRegistryAddress)
  console.log(
    '⛽ Gas Used:',
    (await driverAppRegistry.deploymentTransaction())?.gasLimit?.toString()
  )

  contracts.push({
    name: 'DriverApplicationRegistry',
    address: driverAppRegistryAddress,
    gasUsed: (
      await driverAppRegistry.deploymentTransaction()
    )?.gasLimit?.toString(),
  })

  // Update .env.local with both contract addresses
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8')

    // Remove existing contract address lines
    envContent = envContent.replace(/^NEXT_PUBLIC_CONTRACT_ADDRESS=.*$/m, '')
    envContent = envContent.replace(
      /^NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS=.*$/m,
      ''
    )

    // Add new contract addresses
    envContent += `\nNEXT_PUBLIC_CONTRACT_ADDRESS=${resumeRegistryAddress}\n`
    envContent += `NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS=${driverAppRegistryAddress}\n`

    fs.writeFileSync(envPath, envContent)
    console.log('✅ Updated .env.local with both contract addresses')
  } else {
    console.log('⚠️ .env.local not found - please add manually:')
    console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${resumeRegistryAddress}`)
    console.log(
      `NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS=${driverAppRegistryAddress}`
    )
  }

  // Verify contracts on BaseScan (if not localhost)
  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    console.log('\n🔍 Waiting for block confirmations before verification...')

    // Wait for both transactions to be confirmed
    await Promise.all([
      resumeRegistry.deploymentTransaction()?.wait(6),
      driverAppRegistry.deploymentTransaction()?.wait(6),
    ])

    // Verify ResumeRegistry
    try {
      console.log('🔍 Verifying ResumeRegistry on BaseScan...')
      await hre.run('verify:verify', {
        address: resumeRegistryAddress,
        constructorArguments: [],
      })
      console.log('✅ ResumeRegistry verified successfully!')
    } catch (error) {
      console.log('❌ ResumeRegistry verification failed:', error.message)
    }

    // Verify DriverApplicationRegistry
    try {
      console.log('🔍 Verifying DriverApplicationRegistry on BaseScan...')
      await hre.run('verify:verify', {
        address: driverAppRegistryAddress,
        constructorArguments: [],
      })
      console.log('✅ DriverApplicationRegistry verified successfully!')
    } catch (error) {
      console.log(
        '❌ DriverApplicationRegistry verification failed:',
        error.message
      )
    }
  }

  // Save deployment info
  const deploymentInfo = {
    contracts,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployedAt: new Date().toISOString(),
    deployer: signer.address,
    totalGasUsed: contracts.reduce(
      (total, contract) => total + parseInt(contract.gasUsed || '0'),
      0
    ),
  }

  console.log('\n📋 Deployment Summary:')
  console.log(JSON.stringify(deploymentInfo, null, 2))

  console.log('\n🎯 Next Steps:')
  console.log('1. ✅ Both contract addresses updated in .env.local')
  console.log('2. Test both contract functions')
  console.log('3. Integrate ResumeRegistry with resume upload')
  console.log(
    '4. Integrate DriverApplicationRegistry with driver application form'
  )
  console.log('5. Set up verification workflow for DOT inspectors')

  return deploymentInfo
}

// Execute deployment
main()
  .then((deploymentInfo) => {
    console.log(`\n🎉 All contracts deployed successfully!`)
    console.log(`📊 Total contracts: ${deploymentInfo.contracts.length}`)
    console.log(`⛽ Total gas used: ${deploymentInfo.totalGasUsed}`)
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  })
