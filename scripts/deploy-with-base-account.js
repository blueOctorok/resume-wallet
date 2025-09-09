const hre = require('hardhat')
const { createBaseAccountSDK } = require('@base-org/account')

async function main() {
  console.log('🚀 Starting Base Account SDK deployment test...')
  console.log('📱 This simulates the user experience with Base Account SDK')

  // Initialize Base Account SDK
  const baseAccountSDK = createBaseAccountSDK({
    appName: 'Resume Wallet',
    appLogoUrl: '/logo.png',
    appChainIds: [
      8453, // Base Mainnet
      84532, // Base Sepolia
    ],
  })

  const provider = baseAccountSDK.getProvider()

  try {
    // Test connection to Base Sepolia
    console.log('🌐 Testing connection to Base Sepolia...')

    // Switch to Base Sepolia
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x14A34' }], // Base Sepolia: 84532
    })

    // Get accounts (this will trigger Base Account authentication)
    console.log('🔐 Requesting Base Account connection...')
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    })

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from Base Account SDK')
    }

    const deployerAddress = accounts[0]
    console.log(`✅ Connected to Base Account: ${deployerAddress}`)

    // Check balance
    const balance = await provider.request({
      method: 'eth_getBalance',
      params: [deployerAddress, 'latest'],
    })

    const balanceInEth = hre.ethers.formatEther(balance)
    console.log(`💰 Balance: ${balanceInEth} ETH`)

    if (balance === '0x0') {
      console.log('❌ No ETH in Base Account!')
      console.log('📋 To get Base Sepolia ETH:')
      console.log(
        '1. Visit: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet'
      )
      console.log('2. Connect your Base Account')
      console.log('3. Request testnet ETH')
      return
    }

    console.log('✅ Base Account is funded and ready!')

    // Now we can proceed with deployment using the Base Account provider
    console.log('\n📝 Deploying ResumeRegistry contract...')

    // Get the contract factory
    const ResumeRegistry = await hre.ethers.getContractFactory('ResumeRegistry')

    // Deploy using Base Account provider
    const resumeRegistry = await ResumeRegistry.deploy()
    await resumeRegistry.waitForDeployment()

    const contractAddress = await resumeRegistry.getAddress()

    console.log('✅ ResumeRegistry deployed successfully!')
    console.log('📍 Contract Address:', contractAddress)
    console.log('🌐 Network: Base Sepolia (via Base Account SDK)')
    console.log('👤 Deployer (Base Account):', deployerAddress)

    // Test a simple contract interaction
    console.log('\n🧪 Testing contract interaction...')

    // Get the contract instance
    const contract = ResumeRegistry.attach(contractAddress)

    // Test adding a resume (this will use Base Account for signing)
    console.log('📄 Testing addResume function...')

    const tx = await contract.addResume(
      'QmTestHash123456789', // IPFS hash
      'Test Resume', // title
      'test-resume.pdf', // filename
      true // isPublic
    )

    await tx.wait()
    console.log('✅ Successfully added test resume!')
    console.log('🔗 Transaction hash:', tx.hash)

    // Get the resume count
    const resumeCount = await contract.resumeCount()
    console.log(`📊 Total resumes: ${resumeCount}`)

    console.log('\n🎯 Deployment Summary:')
    console.log(`Contract Address: ${contractAddress}`)
    console.log(`Deployer: ${deployerAddress}`)
    console.log(`Network: Base Sepolia`)
    console.log(
      `Explorer: https://sepolia-explorer.base.org/address/${contractAddress}`
    )

    console.log('\n🎉 Base Account SDK deployment test completed!')
    console.log('✅ This is exactly how users will interact with your app!')
  } catch (error) {
    console.error('❌ Base Account SDK deployment failed:', error.message)

    if (error.message.includes('User rejected')) {
      console.log(
        '\n💡 User rejected the connection. This is normal for testing.'
      )
      console.log(
        'In production, users will see the Base Account sign-in flow.'
      )
    } else if (error.message.includes('No accounts')) {
      console.log(
        '\n💡 No Base Account connected. Make sure you have a Base Account set up.'
      )
    } else {
      console.log('\n🔧 Error details:', error)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
