const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  console.log('🔧 Setting up Base deployment environment...')

  // Check if we have a private key
  if (
    !process.env.PRIVATE_KEY ||
    process.env.PRIVATE_KEY === 'your_deployer_private_key_here'
  ) {
    console.log('❌ No private key configured!')
    console.log('\n📋 To set up deployment:')
    console.log(
      '1. Get Base Sepolia ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet'
    )
    console.log('2. Create a new wallet or use an existing one')
    console.log('3. Add your private key to .env.local:')
    console.log('   PRIVATE_KEY="0x...your_private_key_here"')
    console.log('4. Get BaseScan API key from: https://basescan.org/apis')
    console.log('   BASESCAN_API_KEY="your_api_key_here"')
    console.log('\n⚠️  NEVER commit your private key to version control!')
    return
  }

  // Check if we have BaseScan API key
  if (
    !process.env.BASESCAN_API_KEY ||
    process.env.BASESCAN_API_KEY === 'your_basescan_api_key_here'
  ) {
    console.log('⚠️  No BaseScan API key configured!')
    console.log('Get one from: https://basescan.org/apis')
    console.log('Add to .env.local: BASESCAN_API_KEY="your_api_key_here"')
  }

  // Test connection to Base Sepolia
  try {
    console.log('🌐 Testing connection to Base Sepolia...')
    const provider = new hre.ethers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL
    )
    const network = await provider.getNetwork()
    console.log(
      `✅ Connected to ${network.name} (Chain ID: ${network.chainId})`
    )

    // Check deployer balance
    const [deployer] = await hre.ethers.getSigners()
    const balance = await provider.getBalance(deployer.address)
    const balanceInEth = hre.ethers.formatEther(balance)

    console.log(`👤 Deployer address: ${deployer.address}`)
    console.log(`💰 Balance: ${balanceInEth} ETH`)

    if (balance === 0n) {
      console.log('❌ No ETH in deployer account!')
      console.log(
        'Get Base Sepolia ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet'
      )
      return
    }

    console.log('✅ Deployer account is funded and ready!')
  } catch (error) {
    console.error('❌ Connection test failed:', error.message)
    return
  }

  console.log('\n🎯 Ready to deploy! Run one of these commands:')
  console.log('📦 Deploy to Base Sepolia (testnet):')
  console.log('   npm run deploy:base-sepolia')
  console.log('\n📦 Deploy to Base Mainnet (production):')
  console.log('   npm run deploy:base')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  })
