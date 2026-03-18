const { ethers } = require('hardhat')

/**
 * Deploy script for StormChain (STORM) token and distribution contracts.
 * 
 * Deploys:
 * 1. StormToken - 50M fixed supply ERC20
 * 2. RewardDistributor - Holds 25M for user rewards (decay formula)
 * 3. TreasuryDistributor - Holds 15M for referrals, community, partnerships
 * 4. FounderVesting (x2) - 1.5M each for two founders
 * 
 * Then distributes:
 * - 25M  → RewardDistributor
 * - 15M  → TreasuryDistributor
 * - 5M   → DEX Liquidity wallet
 * - 1.5M → Founder A vesting contract
 * - 1.5M → Founder B vesting contract
 * 
 * IMPORTANT: Set these addresses in .env.local before deploying to mainnet:
 * - DEX_LIQUIDITY_ADDRESS
 * - FOUNDER_A_ADDRESS
 * - FOUNDER_B_ADDRESS
 */

// Token amounts (in full tokens, will convert to wei)
const TOTAL_SUPPLY = 50_000_000n
const REWARD_POOL = 25_000_000n
const TREASURY_ALLOCATION = 15_000_000n
const DEX_LIQUIDITY = 5_000_000n
const FOUNDER_ALLOCATION = 1_500_000n // Each founder gets 1.5M

// Helper to wait for network to catch up (Base Sepolia can be slow)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  console.log('⛈️  Starting StormChain (STORM) Token Deployment...\n')

  const [deployer] = await ethers.getSigners()
  console.log('📝 Deploying with account:', deployer.address)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH')

  const network = await ethers.provider.getNetwork()
  console.log('🌐 Network:', network.name, '(Chain ID:', network.chainId.toString(), ')\n')

  const dexLiquidityAddress = process.env.DEX_LIQUIDITY_ADDRESS || deployer.address
  const founderAAddress = process.env.FOUNDER_A_ADDRESS || deployer.address
  const founderBAddress = process.env.FOUNDER_B_ADDRESS || deployer.address

  console.log('📋 Distribution Addresses:')
  console.log('   DEX Liquidity:', dexLiquidityAddress, dexLiquidityAddress === deployer.address ? '(using deployer for testing)' : '')
  console.log('   Founder A:', founderAAddress, founderAAddress === deployer.address ? '(using deployer for testing)' : '')
  console.log('   Founder B:', founderBAddress, founderBAddress === deployer.address ? '(using deployer for testing)' : '')
  console.log('')

  // ============================================
  // 1. Deploy StormToken
  // ============================================
  console.log('📦 [1/4] Deploying StormToken...')
  const StormToken = await ethers.getContractFactory('StormToken')
  const stormToken = await StormToken.deploy()
  await stormToken.waitForDeployment()
  const tokenAddress = await stormToken.getAddress()
  console.log('✅ StormToken deployed to:', tokenAddress)

  console.log('   Waiting for confirmation...')
  await sleep(5000)

  const deployerBalance = await stormToken.balanceOf(deployer.address)
  console.log('   Deployer received:', ethers.formatEther(deployerBalance), 'STORM')

  // ============================================
  // 2. Deploy RewardDistributor
  // ============================================
  console.log('\n📦 [2/4] Deploying RewardDistributor...')
  const RewardDistributor = await ethers.getContractFactory('RewardDistributor')
  const rewardDistributor = await RewardDistributor.deploy(tokenAddress)
  await rewardDistributor.waitForDeployment()
  const rewardDistributorAddress = await rewardDistributor.getAddress()
  console.log('✅ RewardDistributor deployed to:', rewardDistributorAddress)
  await sleep(3000)

  // ============================================
  // 3. Deploy TreasuryDistributor
  // ============================================
  console.log('\n📦 [3/4] Deploying TreasuryDistributor...')
  const TreasuryDistributor = await ethers.getContractFactory('TreasuryDistributor')
  const treasuryDistributor = await TreasuryDistributor.deploy(tokenAddress)
  await treasuryDistributor.waitForDeployment()
  const treasuryDistributorAddress = await treasuryDistributor.getAddress()
  console.log('✅ TreasuryDistributor deployed to:', treasuryDistributorAddress)
  await sleep(3000)

  // ============================================
  // 4. Deploy FounderVesting contracts
  // ============================================
  console.log('\n📦 [4/4] Deploying FounderVesting contracts...')
  const FounderVesting = await ethers.getContractFactory('FounderVesting')
  
  const vestingA = await FounderVesting.deploy(tokenAddress, founderAAddress)
  await vestingA.waitForDeployment()
  const vestingAAddress = await vestingA.getAddress()
  console.log('✅ FounderVesting A deployed to:', vestingAAddress)
  console.log('   Beneficiary:', founderAAddress)

  const vestingB = await FounderVesting.deploy(tokenAddress, founderBAddress)
  await vestingB.waitForDeployment()
  const vestingBAddress = await vestingB.getAddress()
  console.log('✅ FounderVesting B deployed to:', vestingBAddress)
  console.log('   Beneficiary:', founderBAddress)
  await sleep(3000)

  // ============================================
  // 5. Distribute tokens
  // ============================================
  console.log('\n💸 Distributing tokens...')

  const toWei = (amount) => amount * 10n ** 18n

  console.log('   Transferring 25M to RewardDistributor...')
  let tx = await stormToken.transfer(rewardDistributorAddress, toWei(REWARD_POOL))
  await tx.wait()
  console.log('   ✅ 25M STORM sent to RewardDistributor')

  console.log('   Transferring 15M to TreasuryDistributor...')
  tx = await stormToken.transfer(treasuryDistributorAddress, toWei(TREASURY_ALLOCATION))
  await tx.wait()
  console.log('   ✅ 15M STORM sent to TreasuryDistributor')

  console.log('   Transferring 5M to DEX Liquidity...')
  tx = await stormToken.transfer(dexLiquidityAddress, toWei(DEX_LIQUIDITY))
  await tx.wait()
  console.log('   ✅ 5M STORM sent to DEX Liquidity')

  console.log('   Transferring 1.5M to Founder A vesting...')
  tx = await stormToken.transfer(vestingAAddress, toWei(FOUNDER_ALLOCATION))
  await tx.wait()
  tx = await vestingA.recordAllocation()
  await tx.wait()
  console.log('   ✅ 1.5M STORM sent to Founder A vesting')

  console.log('   Transferring 1.5M to Founder B vesting...')
  tx = await stormToken.transfer(vestingBAddress, toWei(FOUNDER_ALLOCATION))
  await tx.wait()
  tx = await vestingB.recordAllocation()
  await tx.wait()
  console.log('   ✅ 1.5M STORM sent to Founder B vesting')

  // ============================================
  // 6. Verify final balances
  // ============================================
  console.log('\n🔍 Verifying final balances...')
  
  const rewardBalance = await stormToken.balanceOf(rewardDistributorAddress)
  const treasuryBalance = await stormToken.balanceOf(treasuryDistributorAddress)
  const dexBalance = await stormToken.balanceOf(dexLiquidityAddress)
  const vestingABalance = await stormToken.balanceOf(vestingAAddress)
  const vestingBBalance = await stormToken.balanceOf(vestingBAddress)
  const finalDeployerBalance = await stormToken.balanceOf(deployer.address)

  console.log('   RewardDistributor:', ethers.formatEther(rewardBalance), 'STORM')
  console.log('   TreasuryDistributor:', ethers.formatEther(treasuryBalance), 'STORM')
  console.log('   DEX Liquidity:', ethers.formatEther(dexBalance), 'STORM')
  console.log('   Founder A Vesting:', ethers.formatEther(vestingABalance), 'STORM')
  console.log('   Founder B Vesting:', ethers.formatEther(vestingBBalance), 'STORM')
  console.log('   Deployer (should be 0):', ethers.formatEther(finalDeployerBalance), 'STORM')

  const totalDistributed = rewardBalance + treasuryBalance + dexBalance + vestingABalance + vestingBBalance + finalDeployerBalance
  console.log('   Total accounted:', ethers.formatEther(totalDistributed), 'STORM')

  // ============================================
  // 7. Verify vesting schedules
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
      RewardDistributor: rewardDistributorAddress,
      TreasuryDistributor: treasuryDistributorAddress,
      FounderVestingA: vestingAAddress,
      FounderVestingB: vestingBAddress,
    },
    wallets: {
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
  console.log(`   REWARD_DISTRIBUTOR_ADDRESS=${rewardDistributorAddress}`)
  console.log(`   TREASURY_DISTRIBUTOR_ADDRESS=${treasuryDistributorAddress}`)
  console.log(`   FOUNDER_VESTING_A_ADDRESS=${vestingAAddress}`)
  console.log(`   FOUNDER_VESTING_B_ADDRESS=${vestingBAddress}`)
  console.log('')
  console.log('2. Grant DISTRIBUTOR_ROLE to your backend wallet on both distributors:')
  console.log('   (The deployer already has this role on both)')
  console.log('')
  console.log('3. Verify contracts on BaseScan:')
  console.log(`   npx hardhat verify --network baseSepolia ${tokenAddress}`)
  console.log(`   npx hardhat verify --network baseSepolia ${rewardDistributorAddress} "${tokenAddress}"`)
  console.log(`   npx hardhat verify --network baseSepolia ${treasuryDistributorAddress} "${tokenAddress}"`)
  console.log(`   npx hardhat verify --network baseSepolia ${vestingAAddress} "${tokenAddress}" "${founderAAddress}"`)
  console.log(`   npx hardhat verify --network baseSepolia ${vestingBAddress} "${tokenAddress}" "${founderBAddress}"`)

  return deploymentInfo
}

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
