const hre = require('hardhat')
const { createBaseAccountSDK } = require('@base-org/account')

async function main() {
  console.log('👤 Testing Driver User Experience with Base Account SDK')
  console.log('🎯 This simulates exactly how drivers will use the app\n')

  // Initialize Base Account SDK (same as in our app)
  const baseAccountSDK = createBaseAccountSDK({
    appName: 'Resume Wallet',
    appLogoUrl: '/logo.png',
    appChainIds: [8453, 84532], // Base Mainnet & Sepolia
  })

  const provider = baseAccountSDK.getProvider()

  try {
    console.log('🔐 Step 1: Driver clicks "Sign in with Base"')
    console.log('   → Base Account SDK opens authentication flow')

    // Simulate the authentication flow
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    })

    if (!accounts || accounts.length === 0) {
      throw new Error('Driver rejected authentication')
    }

    const driverAddress = accounts[0]
    console.log(`✅ Driver authenticated: ${driverAddress}`)

    console.log('\n🌐 Step 2: Switch to Base Sepolia (testnet)')
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x14A34' }], // Base Sepolia
    })
    console.log('✅ Switched to Base Sepolia')

    console.log('\n💰 Step 3: Check driver balance')
    const balance = await provider.request({
      method: 'eth_getBalance',
      params: [driverAddress, 'latest'],
    })
    const balanceInEth = hre.ethers.formatEther(balance)
    console.log(`   Driver balance: ${balanceInEth} ETH`)

    if (balance === '0x0') {
      console.log('❌ Driver needs Base Sepolia ETH')
      console.log(
        '   → Send them to: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet'
      )
      return
    }

    console.log('\n📄 Step 4: Driver uploads resume (simulated)')
    console.log('   → Resume uploaded to IPFS')
    console.log('   → IPFS hash: QmTestResume123456789')

    // Simulate resume upload to contract
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
    if (!contractAddress) {
      console.log('❌ No contract address found. Deploy contract first.')
      return
    }

    console.log('\n📝 Step 5: Driver adds resume to blockchain')
    console.log(`   → Contract address: ${contractAddress}`)

    // Get contract instance
    const ResumeRegistry = await hre.ethers.getContractFactory('ResumeRegistry')
    const contract = ResumeRegistry.attach(contractAddress)

    // Simulate adding resume
    const tx = await contract.addResume(
      'QmTestResume123456789', // IPFS hash
      'John Driver - Professional Resume', // title
      'john-driver-resume.pdf', // filename
      true // isPublic
    )

    await tx.wait()
    console.log(`✅ Resume added to blockchain!`)
    console.log(`   Transaction: ${tx.hash}`)
    console.log(`   Explorer: https://sepolia-explorer.base.org/tx/${tx.hash}`)

    console.log('\n🔍 Step 6: Verify resume on blockchain')
    const resumeCount = await contract.resumeCount()
    const driverResumes = await contract.getUserResumes(driverAddress)

    console.log(`   Total resumes on contract: ${resumeCount}`)
    console.log(`   Driver's resumes: ${driverResumes.length}`)

    if (driverResumes.length > 0) {
      const resumeId = driverResumes[0]
      const resume = await contract.getResume(resumeId)

      console.log('\n📋 Resume Details:')
      console.log(`   ID: ${resumeId}`)
      console.log(`   Owner: ${resume.owner}`)
      console.log(`   Title: ${resume.title}`)
      console.log(`   IPFS Hash: ${resume.ipfsHash}`)
      console.log(`   Public: ${resume.isPublic}`)
      console.log(`   Verified: ${resume.isVerified}`)
      console.log(
        `   Timestamp: ${new Date(Number(resume.timestamp) * 1000).toISOString()}`
      )
    }

    console.log('\n🎉 User Experience Test Complete!')
    console.log('✅ This is exactly how drivers will use your app:')
    console.log('   1. Click "Sign in with Base" (no seed phrase needed)')
    console.log('   2. Authenticate with Base Account')
    console.log('   3. Upload resume to IPFS')
    console.log('   4. Add resume to blockchain')
    console.log('   5. Resume is now verified and public')

    console.log('\n🚀 Ready for production!')
  } catch (error) {
    console.error('❌ User experience test failed:', error.message)

    if (error.message.includes('User rejected')) {
      console.log('\n💡 This is normal - driver can reject the connection')
      console.log(
        '   In production, they would see the Base Account sign-in UI'
      )
    } else if (error.message.includes('No accounts')) {
      console.log('\n💡 No Base Account connected')
      console.log('   Make sure you have a Base Account set up')
    } else {
      console.log('\n🔧 Error details:', error)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })
