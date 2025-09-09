const hre = require('hardhat')

async function main() {
  console.log('🔧 ResumeRegistry Contract Interaction Script')

  // Get the contract address from environment or use a default
  const contractAddress = process.env.CONTRACT_ADDRESS || '0x...' // Replace with deployed address

  if (contractAddress === '0x...') {
    console.log('❌ Please set CONTRACT_ADDRESS environment variable')
    console.log('   Example: CONTRACT_ADDRESS=0x123... npm run interact')
    return
  }

  // Get the contract instance
  const ResumeRegistry = await hre.ethers.getContractFactory('ResumeRegistry')
  const contract = ResumeRegistry.attach(contractAddress)

  console.log('📍 Contract Address:', contractAddress)
  console.log('🌐 Network:', hre.network.name)

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners()
  console.log('👤 Deployer:', deployer.address)

  try {
    // Test basic contract functions
    console.log('\n📊 Contract State:')
    const resumeCount = await contract.resumeCount()
    const owner = await contract.owner()
    const paused = await contract.paused()

    console.log('📝 Total Resumes:', resumeCount.toString())
    console.log('👑 Owner:', owner)
    console.log('⏸️  Paused:', paused)

    // Test adding a resume (if you want to)
    if (process.argv.includes('--add-resume')) {
      console.log('\n➕ Adding test resume...')

      const tx = await contract.addResume(
        'QmTestHash123...', // IPFS hash
        'Test Resume', // Title
        'resume.pdf', // Filename
        true // Is public
      )

      await tx.wait()
      console.log('✅ Test resume added!')
    }

    // Test getting user resumes
    console.log('\n📋 User Resumes:')
    const userResumes = await contract.getUserResumes(deployer.address)
    console.log(
      'Resume IDs:',
      userResumes.map((id) => id.toString())
    )

    // Test getting public resumes
    console.log('\n🌐 Public Resumes:')
    const publicResumes = await contract.getPublicResumes()
    console.log(
      'Public Resume IDs:',
      publicResumes.map((id) => id.toString())
    )
  } catch (error) {
    console.error('❌ Error interacting with contract:', error.message)
  }
}

main()
  .then(() => {
    console.log('\n✅ Interaction completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Interaction failed:', error)
    process.exit(1)
  })
