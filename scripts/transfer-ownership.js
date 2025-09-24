const { ethers } = require('hardhat')

async function main() {
  console.log('🔄 Starting ownership transfer...')

  // Contract address (you'll need to update this after deployment)
  const contractAddress = process.env.NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS
  if (!contractAddress) {
    throw new Error(
      'Please set NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS in .env.local'
    )
  }

  // New owner (your Alchemy Smart Wallet)
  const newOwner = '0x7682D6a5b1F3988f85DE72A721e72c8E6279cb07'

  // Get the current deployer (MetaMask wallet)
  const [deployer] = await ethers.getSigners()
  console.log('📝 Current owner (deployer):', deployer.address)
  console.log('🎯 New owner (Alchemy Smart Wallet):', newOwner)

  // Get contract instance
  const ResumeRegistry = await ethers.getContractFactory('ResumeRegistry')
  const resumeRegistry = ResumeRegistry.attach(contractAddress)

  // Verify current ownership
  const currentOwner = await resumeRegistry.owner()
  console.log('🔍 Contract current owner:', currentOwner)

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error('Deployer is not the current owner!')
  }

  // Transfer ownership
  console.log('\n🔄 Transferring ownership...')
  const tx = await resumeRegistry.transferOwnership(newOwner)
  console.log('⏳ Transaction hash:', tx.hash)

  // Wait for confirmation
  await tx.wait()
  console.log('✅ Transaction confirmed!')

  // Verify new ownership
  const verifyOwner = await resumeRegistry.owner()
  console.log('🔍 New contract owner:', verifyOwner)

  // Verify roles
  const DEFAULT_ADMIN_ROLE = await resumeRegistry.DEFAULT_ADMIN_ROLE()
  const ADMIN_ROLE = await resumeRegistry.ADMIN_ROLE()
  const VERIFIER_ROLE = await resumeRegistry.VERIFIER_ROLE()

  const newOwnerHasAdmin = await resumeRegistry.hasRole(
    DEFAULT_ADMIN_ROLE,
    newOwner
  )
  const newOwnerHasVerifier = await resumeRegistry.hasRole(
    VERIFIER_ROLE,
    newOwner
  )

  console.log('\n🔐 Role verification:')
  console.log('New owner has admin role:', newOwnerHasAdmin)
  console.log('New owner has verifier role:', newOwnerHasVerifier)

  // Grant roles to new owner if needed
  if (!newOwnerHasAdmin) {
    console.log('🔄 Granting admin role to new owner...')
    const grantAdminTx = await resumeRegistry.grantRole(ADMIN_ROLE, newOwner)
    await grantAdminTx.wait()
    console.log('✅ Admin role granted!')
  }

  if (!newOwnerHasVerifier) {
    console.log('🔄 Granting verifier role to new owner...')
    const grantVerifierTx = await resumeRegistry.grantRole(
      VERIFIER_ROLE,
      newOwner
    )
    await grantVerifierTx.wait()
    console.log('✅ Verifier role granted!')
  }

  console.log('\n🎉 Ownership transfer completed successfully!')
  console.log('📍 Contract:', contractAddress)
  console.log('👤 New Owner:', newOwner)
  console.log('✅ Your Alchemy Smart Wallet now owns the contract!')
}

// Handle errors
main()
  .then(() => {
    console.log('\n✅ Ownership transfer completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Ownership transfer failed:')
    console.error(error)
    process.exit(1)
  })
