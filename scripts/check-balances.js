require('dotenv').config({ path: '.env.local' })
const { ethers } = require('hardhat')

async function checkBalances() {
  const address = '0x346f7053a3D08c7eb47a741f71C0BA5B5d9eB158'

  console.log('🔍 Checking balances for:', address)
  console.log()

  // Base Sepolia
  try {
    const baseSepoliaProvider = new ethers.JsonRpcProvider(
      'https://base-sepolia.g.alchemy.com/v2/1EacVcYetgk_QIWCKp4hI'
    )
    const baseSepoliaBalance = await baseSepoliaProvider.getBalance(address)
    console.log(
      '🟦 Base Sepolia:',
      ethers.formatEther(baseSepoliaBalance),
      'ETH'
    )
  } catch (error) {
    console.log('❌ Base Sepolia: Error checking balance')
  }

  // Ethereum Sepolia
  try {
    const ethSepoliaProvider = new ethers.JsonRpcProvider(
      'https://eth-sepolia.g.alchemy.com/v2/1EacVcYetgk_QIWCKp4hI'
    )
    const ethSepoliaBalance = await ethSepoliaProvider.getBalance(address)
    console.log(
      '🟨 Ethereum Sepolia:',
      ethers.formatEther(ethSepoliaBalance),
      'ETH'
    )
  } catch (error) {
    console.log('❌ Ethereum Sepolia: Error checking balance')
  }

  // Base Mainnet
  try {
    const baseMainnetProvider = new ethers.JsonRpcProvider(
      'https://base-mainnet.g.alchemy.com/v2/1EacVcYetgk_QIWCKp4hI'
    )
    const baseMainnetBalance = await baseMainnetProvider.getBalance(address)
    console.log(
      '🟦 Base Mainnet:',
      ethers.formatEther(baseMainnetBalance),
      'ETH'
    )
  } catch (error) {
    console.log('❌ Base Mainnet: Error checking balance')
  }

  console.log()
  console.log(
    '💡 If you have ETH on Ethereum Sepolia, you can bridge it to Base Sepolia'
  )
  console.log(
    '💡 Or get free Base Sepolia ETH from: https://www.alchemy.com/faucets/base-sepolia'
  )
}

checkBalances().catch(console.error)
