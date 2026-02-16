const { ethers } = require('hardhat')

/**
 * Deploy script for StormChain (STORM) token and distribution contracts.
 * 
 * Deploys:
 * 1. StormToken - 15M fixed supply ERC20
 * 2. RewardDistributor - Holds 9M for user rewards
 * 3. FounderVesting (x2) - 1M each for two founders
 * 
 * Then distributes:
 * - 9M → RewardDistributor
 * - 3M → Treasury wallet
 * - 1M → DEX Liquidity wallet
 * - 1M → Founder A vesting contract
 * - 1M → Founder B vesting contract
 * 
 * IMPORTANT: Set these addresses in .env.local before deploying to mainnet:
 * - TREASURY_ADDRESS
 * - DEX_LIQUIDITY_ADDRESS
 * - FOUNDER_A_ADDRESS
 * - FOUNDER_B_ADDRESS
 */

// Token amounts (in full tokens, will convert to wei)
const TOTAL_SUPPLY = 15_000_000n
const REWARD_POOL = 9_000_000n
const TREASURY_ALLOCATION = 3_000_000n
const DEX_LIQUIDITY = 1_000_000n
const FOUNDER_ALLOCATION = 1_000_000n // Each founder gets 1M

// Helper to wait for network to catch up (Base Sepolia can be slow)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  console.log('⛈️  Starting StormChain (STORM) Token Deployment...\n')

  // Get the deployer account
  const [deployer] = await ethers.getSigners()
  console.log('📝 Deploying with account:', deployer.address)

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH')

  // Get network info
  const network = await ethers.provider.getNetwork()
  console.log('🌐 Network:', network.name, '(Chain ID:', network.chainId.toString(), ')\n')

  // Get recipient addresses from env or use deployer for testing
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address
  const dexLiquidityAddress = process.env.DEX_LIQUIDITY_ADDRESS || deployer.address
  const founderAAddress = process.env.FOUNDER_A_ADDRESS || deployer.address
  const founderBAddress = process.env.FOUNDER_B_ADDRESS || deployer.address

  console.log('📋 Distribution Addresses:')
  console.log('   Treasury:', treasuryAddress, treasuryAddress === deployer.address ? '(using deployer for testing)' : '')
  console.log('   DEX Liquidity:', dexLiquidityAddress, dexLiquidityAddress === deployer.address ? '(using deployer for testing)' : '')
  console.log('   Founder A:', founderAAddress, founderAAddress === deployer.address ? '(using deployer for testing)' : '')
  console.log('   Founder B:', founderBAddress, founderBAddress === deployer.address ? '(using deployer for testing)' : '')
  console.log('')

  // ============================================
  // 1. Deploy StormToken
  // ============================================
  console.log('📦 [1/3] Deploying StormToken...')
  const StormToken = await ethers.getContractFactory('StormToken')
  const stormToken = await StormToken.deploy()
  await stormToken.waitForDeployment()
  const tokenAddress = await stormToken.getAddress()
  console.log('✅ StormToken deployed to:', tokenAddress)

  // Wait for network to confirm (Base Sepolia can be slow)
  console.log('   Waiting for confirmation...')
  await sleep(5000)

  // Verify initial supply went to deployer
  const deployerBalance = await stormToken.balanceOf(deployer.address)
  console.log('   Deployer received:', ethers.formatEther(deployerBalance), 'STORM')

  // ============================================
  // 2. Deploy RewardDistributor
  // ============================================
  console.log('\n📦 [2/3] Deploying RewardDistributor...')
  const RewardDistributor = await ethers.getContractFactory('RewardDistributor')
  const rewardDistributor = await RewardDistributor.deploy(tokenAddress)
  await rewardDistributor.waitForDeployment()
  const distributorAddress = await rewardDistributor.getAddress()
  console.log('✅ RewardDistributor deployed to:', distributorAddress)
  await sleep(3000)

  // ============================================
  // 3. Deploy FounderVesting contracts
  // ============================================
  console.log('\n📦 [3/3] Deploying FounderVesting contracts...')
  const FounderVesting = await ethers.getContractFactory('FounderVesting')
  
  // Founder A vesting
  const vestingA = await FounderVesting.deploy(tokenAddress, founderAAddress)
  await vestingA.waitForDeployment()
  const vestingAAddress = await vestingA.getAddress()
  console.log('✅ FounderVesting A deployed to:', vestingAAddress)
  console.log('   Beneficiary:', founderAAddress)

  // Founder B vesting
  const vestingB = await FounderVesting.deploy(tokenAddress, founderBAddress)
  await vestingB.waitForDeployment()
  const vestingBAddress = await vestingB.getAddress()
  console.log('✅ FounderVesting B deployed to:', vestingBAddress)
  console.log('   Beneficiary:', founderBAddress)
  await sleep(3000)

  // ============================================
  // 4. Distribute tokens
  // ============================================
  console.log('\n💸 Distributing tokens...')

  // Convert to wei (18 decimals)
  const toWei = (amount) => amount * 10n ** 18n

  // Transfer 9M to RewardDistributor
  console.log('   Transferring 9M to RewardDistributor...')
  let tx = await stormToken.transfer(distributorAddress, toWei(REWARD_POOL))
  await tx.wait()
  console.log('   ✅ 9M STORM sent to RewardDistributor')

  // Transfer 3M to Treasury
  console.log('   Transferring 3M to Treasury...')
  tx = await stormToken.transfer(treasuryAddress, toWei(TREASURY_ALLOCATION))
  await tx.wait()
  console.log('   ✅ 3M STORM sent to Treasury')

  // Transfer 1M to DEX Liquidity wallet
  console.log('   Transferring 1M to DEX Liquidity...')
  tx = await stormToken.transfer(dexLiquidityAddress, toWei(DEX_LIQUIDITY))
  await tx.wait()
  console.log('   ✅ 1M STORM sent to DEX Liquidity')

  // Transfer 1M to Founder A vesting
  console.log('   Transferring 1M to Founder A vesting...')
  tx = await stormToken.transfer(vestingAAddress, toWei(FOUNDER_ALLOCATION))
  await tx.wait()
  // Record allocation in vesting contract
  tx = await vestingA.recordAllocation()
  await tx.wait()
  console.log('   ✅ 1M STORM sent to Founder A vesting')

  // Transfer 1M to Founder B vesting
  console.log('   Transferring 1M to Founder B vesting...')
  tx = await stormToken.transfer(vestingBAddress, toWei(FOUNDER_ALLOCATION))
  await tx.wait()
  // Record allocation in vesting contract
  tx = await vestingB.recordAllocation()
  await tx.wait()
  console.log('   ✅ 1M STORM sent to Founder B vesting')

  // ============================================
  // 5. Verify final balances
  // ============================================
  console.log('\n🔍 Verifying final balances...')
  
  const distributorBalance = await stormToken.balanceOf(distributorAddress)
  const treasuryBalance = await stormToken.balanceOf(treasuryAddress)
  const dexBalance = await stormToken.balanceOf(dexLiquidityAddress)
  const vestingABalance = await stormToken.balanceOf(vestingAAddress)
  const vestingBBalance = await stormToken.balanceOf(vestingBAddress)
  const finalDeployerBalance = await stormToken.balanceOf(deployer.address)

  console.log('   RewardDistributor:', ethers.formatEther(distributorBalance), 'STORM')
  console.log('   Treasury:', ethers.formatEther(treasuryBalance), 'STORM')
  console.log('   DEX Liquidity:', ethers.formatEther(dexBalance), 'STORM')
  console.log('   Founder A Vesting:', ethers.formatEther(vestingABalance), 'STORM')
  console.log('   Founder B Vesting:', ethers.formatEther(vestingBBalance), 'STORM')
  console.log('   Deployer (should be 0):', ethers.formatEther(finalDeployerBalance), 'STORM')

  // Verify total adds up
  const totalDistributed = distributorBalance + treasuryBalance + dexBalance + vestingABalance + vestingBBalance + finalDeployerBalance
  console.log('   Total accounted:', ethers.formatEther(totalDistributed), 'STORM')

  // ============================================
  // 6. Verify vesting schedules
  // ============================================
  console.log('\n📅 Vesting Schedule Info:')
  const vestingStatusA = await vestingA.vestingStatus()
  console.log('   Founder A:')
  console.log('     Total allocation:', ethers.formatEther(vestingStatusA._totalAllocation), 'STORM')
  console.log('     Cliff ends:', new Date(Number(vestingStatusA._cliffEndsAt) * 1000).toISOString())
  console.log('     Fully vested:', new Date(Number(vestingStatusA._vestingEndsAt) * 1000).toISOString())

  // ============================================
  // Summary
  // ============================================
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contracts: {
      StormToken: tokenAddress,
      RewardDistributor: distributorAddress,
      FounderVestingA: vestingAAddress,
      FounderVestingB: vestingBAddress,
    },
    wallets: {
      treasury: treasuryAddress,
      dexLiquidity: dexLiquidityAddress,
      founderA: founderAAddress,
      founderB: founderBAddress,
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  }

  console.log('\n📋 Deployment Summary:')
  console.log(JSON.stringify(deploymentInfo, null, 2))

  console.log('\n📝 Next Steps:')
  console.log('1. Add contract addresses to your .env.local file:')
  console.log(`   STORM_TOKEN_ADDRESS=${tokenAddress}`)
  console.log(`   REWARD_DISTRIBUTOR_ADDRESS=${distributorAddress}`)
  console.log(`   FOUNDER_VESTING_A_ADDRESS=${vestingAAddress}`)
  console.log(`   FOUNDER_VESTING_B_ADDRESS=${vestingBAddress}`)
  console.log('')
  console.log('2. Grant DISTRIBUTOR_ROLE to your backend wallet:')
  console.log('   (The deployer already has this role)')
  console.log('')
  console.log('3. Verify contracts on BaseScan:')
  console.log(`   npx hardhat verify --network baseSepolia ${tokenAddress}`)
  console.log(`   npx hardhat verify --network baseSepolia ${distributorAddress} "${tokenAddress}"`)
  console.log(`   npx hardhat verify --network baseSepolia ${vestingAAddress} "${tokenAddress}" "${founderAAddress}"`)
  console.log(`   npx hardhat verify --network baseSepolia ${vestingBAddress} "${tokenAddress}" "${founderBAddress}"`)

  return deploymentInfo
}

// Handle errors
main()
  .then((info) => {
    console.log('\n⛈️  StormChain deployment completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:')
    console.error(error)
    process.exit(1)
  })
