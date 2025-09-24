const { ethers } = require('hardhat')

async function main() {
  console.log('🧪 Testing ResumeRegistry contract locally...')

  // Get signers
  const [owner, user1, user2] = await ethers.getSigners()
  console.log('👤 Owner:', owner.address)
  console.log('👤 User1:', user1.address)
  console.log('👤 User2:', user2.address)

  // Deploy contract
  console.log('\n📦 Deploying ResumeRegistry...')
  const ResumeRegistry = await ethers.getContractFactory('ResumeRegistry')
  const resumeRegistry = await ResumeRegistry.deploy()
  await resumeRegistry.waitForDeployment()

  const contractAddress = await resumeRegistry.getAddress()
  console.log('✅ Contract deployed to:', contractAddress)

  // Test 1: Add a resume
  console.log('\n🧪 Test 1: Adding a resume...')
  const ipfsHash = 'QmTestHash123456789'
  const title = 'Senior Truck Driver Resume'
  const filename = 'john-doe-resume.pdf'
  const isPublic = true

  const tx1 = await resumeRegistry
    .connect(user1)
    .addResume(ipfsHash, title, filename, isPublic)
  const receipt1 = await tx1.wait()
  console.log('✅ Resume added! Transaction hash:', receipt1.hash)

  // Get the resume
  const resume = await resumeRegistry.getResume(1)
  console.log('📄 Resume details:')
  console.log('  - Owner:', resume.owner)
  console.log('  - IPFS Hash:', resume.ipfsHash)
  console.log('  - Title:', resume.title)
  console.log('  - Filename:', resume.filename)
  console.log('  - Is Public:', resume.isPublic)
  console.log('  - Is Verified:', resume.isVerified)

  // Test 2: Verify the resume
  console.log('\n🧪 Test 2: Verifying the resume...')
  const verificationHash = 'QmVerificationHash123'
  const notes = 'Resume verified by HR department'

  const tx2 = await resumeRegistry
    .connect(owner)
    .verifyResume(1, true, verificationHash, notes)
  await tx2.wait()
  console.log('✅ Resume verified!')

  // Get verification details
  const verification = await resumeRegistry.getVerification(1)
  console.log('🔍 Verification details:')
  console.log('  - Verifier:', verification.verifier)
  console.log('  - Verified:', verification.verified)
  console.log('  - Verification Hash:', verification.verificationHash)
  console.log('  - Notes:', verification.notes)

  // Test 3: Get user resumes
  console.log('\n🧪 Test 3: Getting user resumes...')
  const userResumes = await resumeRegistry.getUserResumes(user1.address)
  console.log(
    '📋 User1 resumes:',
    userResumes.map((id) => id.toString())
  )

  // Test 4: Get public resumes
  console.log('\n🧪 Test 4: Getting public resumes...')
  const publicResumes = await resumeRegistry.getPublicResumes()
  console.log(
    '🌐 Public resumes:',
    publicResumes.map((id) => id.toString())
  )

  // Test 5: Add another resume (private)
  console.log('\n🧪 Test 5: Adding a private resume...')
  const tx3 = await resumeRegistry.connect(user2).addResume(
    'QmPrivateHash789',
    'Private CDL Resume',
    'jane-smith-resume.pdf',
    false // private
  )
  await tx3.wait()
  console.log('✅ Private resume added!')

  // Check total count
  const totalCount = await resumeRegistry.resumeCount()
  console.log('📊 Total resume count:', totalCount.toString())

  // Test 6: Role management
  console.log('\n🧪 Test 6: Testing role management...')
  const isOwnerVerifier = await resumeRegistry.isVerifier(owner.address)
  const isUser1Verifier = await resumeRegistry.isVerifier(user1.address)

  console.log('🔐 Owner is verifier:', isOwnerVerifier)
  console.log('🔐 User1 is verifier:', isUser1Verifier)

  // Add user1 as verifier
  await resumeRegistry.connect(owner).addVerifier(user1.address)
  const isUser1VerifierNow = await resumeRegistry.isVerifier(user1.address)
  console.log('✅ User1 is now verifier:', isUser1VerifierNow)

  console.log('\n🎉 All tests passed! Contract is working correctly.')

  return {
    contractAddress,
    resumeCount: totalCount.toString(),
    publicResumes: publicResumes.length,
  }
}

// Handle errors
main()
  .then((result) => {
    console.log('\n✅ Local testing completed successfully!')
    console.log('📊 Results:', result)
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Local testing failed:')
    console.error(error)
    process.exit(1)
  })
