const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('ResumeRegistry', function () {
  let resumeRegistry
  let owner
  let verifier
  let user1
  let user2
  let admin

  // Role constants
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('VERIFIER_ROLE'))
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'))

  beforeEach(async function () {
    // Get signers
    ;[owner, verifier, user1, user2, admin] = await ethers.getSigners()

    // Deploy contract
    const ResumeRegistry = await ethers.getContractFactory('ResumeRegistry')
    resumeRegistry = await ResumeRegistry.deploy()
    await resumeRegistry.waitForDeployment()

    // Grant roles
    await resumeRegistry.grantRole(VERIFIER_ROLE, verifier.address)
    await resumeRegistry.grantRole(ADMIN_ROLE, admin.address)
  })

  describe('Deployment', function () {
    it('Should set the correct owner', async function () {
      expect(await resumeRegistry.owner()).to.equal(owner.address)
    })

    it('Should initialize with zero resume count', async function () {
      expect(await resumeRegistry.resumeCount()).to.equal(0)
    })

    it('Should grant admin role to owner', async function () {
      expect(await resumeRegistry.hasRole(ADMIN_ROLE, owner.address)).to.be.true
    })

    it('Should grant verifier role to owner', async function () {
      expect(await resumeRegistry.hasRole(VERIFIER_ROLE, owner.address)).to.be
        .true
    })
  })

  describe('Role Management', function () {
    it('Should allow admin to add verifier', async function () {
      await resumeRegistry.connect(admin).addVerifier(user1.address)
      expect(await resumeRegistry.isVerifier(user1.address)).to.be.true
    })

    it('Should allow admin to remove verifier', async function () {
      await resumeRegistry.connect(admin).addVerifier(user1.address)
      await resumeRegistry.connect(admin).removeVerifier(user1.address)
      expect(await resumeRegistry.isVerifier(user1.address)).to.be.false
    })

    it('Should not allow non-admin to add verifier', async function () {
      await expect(
        resumeRegistry.connect(user1).addVerifier(user2.address)
      ).to.be.revertedWithCustomError(
        resumeRegistry,
        'AccessControlUnauthorizedAccount'
      )
    })

    it('Should emit VerifierAdded event', async function () {
      await expect(resumeRegistry.connect(admin).addVerifier(user1.address))
        .to.emit(resumeRegistry, 'VerifierAdded')
        .withArgs(user1.address)
    })

    it('Should emit VerifierRemoved event', async function () {
      await resumeRegistry.connect(admin).addVerifier(user1.address)
      await expect(resumeRegistry.connect(admin).removeVerifier(user1.address))
        .to.emit(resumeRegistry, 'VerifierRemoved')
        .withArgs(user1.address)
    })
  })

  describe('Resume Management', function () {
    const testIpfsHash = 'QmTestHash123'
    const testTitle = 'Test Resume'
    const testFilename = 'resume.pdf'

    it('Should allow users to add resume', async function () {
      await resumeRegistry
        .connect(user1)
        .addResume(testIpfsHash, testTitle, testFilename, true)

      const resume = await resumeRegistry.getResume(1)
      expect(resume.owner).to.equal(user1.address)
      expect(resume.ipfsHash).to.equal(testIpfsHash)
      expect(resume.title).to.equal(testTitle)
      expect(resume.filename).to.equal(testFilename)
      expect(resume.isPublic).to.be.true
      expect(resume.timestamp).to.be.greaterThan(0)
    })

    it('Should increment resume count', async function () {
      await resumeRegistry
        .connect(user1)
        .addResume(testIpfsHash, testTitle, testFilename, true)
      expect(await resumeRegistry.resumeCount()).to.equal(1)
    })

    it('Should track user resumes', async function () {
      await resumeRegistry
        .connect(user1)
        .addResume(testIpfsHash, testTitle, testFilename, true)
      const userResumes = await resumeRegistry.getUserResumes(user1.address)
      expect(userResumes.length).to.equal(1)
      expect(userResumes[0]).to.equal(1)
    })

    it('Should prevent duplicate IPFS hashes', async function () {
      await resumeRegistry
        .connect(user1)
        .addResume(testIpfsHash, testTitle, testFilename, true)

      await expect(
        resumeRegistry
          .connect(user2)
          .addResume(testIpfsHash, 'Another Title', 'another.pdf', true)
      ).to.be.revertedWith('IPFS hash already used')
    })

    it('Should emit ResumeAdded event', async function () {
      await expect(
        resumeRegistry
          .connect(user1)
          .addResume(testIpfsHash, testTitle, testFilename, true)
      )
        .to.emit(resumeRegistry, 'ResumeAdded')
        .withArgs(1, user1.address, testIpfsHash, testTitle)
    })

    it('Should allow resume update by owner', async function () {
      await resumeRegistry
        .connect(user1)
        .addResume(testIpfsHash, testTitle, testFilename, true)

      const newIpfsHash = 'QmNewHash456'
      const newTitle = 'Updated Resume'

      await resumeRegistry
        .connect(user1)
        .updateResume(1, newIpfsHash, newTitle, false)

      const resume = await resumeRegistry.getResume(1)
      expect(resume.ipfsHash).to.equal(newIpfsHash)
      expect(resume.title).to.equal(newTitle)
      expect(resume.isPublic).to.be.false
    })

    it('Should not allow resume update by non-owner', async function () {
      await resumeRegistry
        .connect(user1)
        .addResume(testIpfsHash, testTitle, testFilename, true)

      await expect(
        resumeRegistry
          .connect(user2)
          .updateResume(1, 'QmNewHash456', 'Updated Resume', false)
      ).to.be.revertedWith('Only resume owner can update')
    })

    it('Should emit ResumeUpdated event', async function () {
      await resumeRegistry
        .connect(user1)
        .addResume(testIpfsHash, testTitle, testFilename, true)

      const newIpfsHash = 'QmNewHash456'
      const newTitle = 'Updated Resume'

      await expect(
        resumeRegistry
          .connect(user1)
          .updateResume(1, newIpfsHash, newTitle, false)
      )
        .to.emit(resumeRegistry, 'ResumeUpdated')
        .withArgs(1, user1.address, newIpfsHash)
    })
  })

  describe('Resume Verification', function () {
    const testIpfsHash = 'QmTestHash123'
    const testTitle = 'Test Resume'
    const testFilename = 'resume.pdf'

    beforeEach(async function () {
      await resumeRegistry
        .connect(user1)
        .addResume(testIpfsHash, testTitle, testFilename, true)
    })

    it('Should allow verifier to verify resume', async function () {
      const verificationHash = 'QmVerificationHash'
      const notes = 'Verified successfully'

      await resumeRegistry
        .connect(verifier)
        .verifyResume(1, true, verificationHash, notes)

      const verification = await resumeRegistry.getVerification(1)
      expect(verification.verified).to.be.true
      expect(verification.verifier).to.equal(verifier.address)
      expect(verification.verificationHash).to.equal(verificationHash)
      expect(verification.notes).to.equal(notes)
      expect(verification.timestamp).to.be.greaterThan(0)
    })

    it('Should allow verifier to reject resume', async function () {
      const verificationHash = 'QmRejectionHash'
      const notes = 'Rejected due to invalid information'

      await resumeRegistry
        .connect(verifier)
        .verifyResume(1, false, verificationHash, notes)

      const verification = await resumeRegistry.getVerification(1)
      expect(verification.verified).to.be.false
      expect(verification.verifier).to.equal(verifier.address)
    })

    it('Should not allow non-verifier to verify resume', async function () {
      await expect(
        resumeRegistry.connect(user1).verifyResume(1, true, 'QmHash', 'Notes')
      ).to.be.revertedWithCustomError(
        resumeRegistry,
        'AccessControlUnauthorizedAccount'
      )
    })

    it('Should emit ResumeVerified event', async function () {
      const verificationHash = 'QmVerificationHash'
      const notes = 'Verified successfully'

      await expect(
        resumeRegistry
          .connect(verifier)
          .verifyResume(1, true, verificationHash, notes)
      )
        .to.emit(resumeRegistry, 'ResumeVerified')
        .withArgs(1, verifier.address, true)
    })
  })

  describe('Public Resume Access', function () {
    it('Should return public resumes only', async function () {
      // Add public resume
      await resumeRegistry
        .connect(user1)
        .addResume('QmPublicHash', 'Public Resume', 'public.pdf', true)

      // Add private resume
      await resumeRegistry
        .connect(user2)
        .addResume('QmPrivateHash', 'Private Resume', 'private.pdf', false)

      const publicResumes = await resumeRegistry.getPublicResumes()
      expect(publicResumes.length).to.equal(1)
      expect(publicResumes[0]).to.equal(1)
    })

    it('Should return empty array when no public resumes', async function () {
      await resumeRegistry
        .connect(user1)
        .addResume('QmPrivateHash', 'Private Resume', 'private.pdf', false)

      const publicResumes = await resumeRegistry.getPublicResumes()
      expect(publicResumes.length).to.equal(0)
    })
  })

  describe('Pausable Functionality', function () {
    it('Should allow admin to pause contract', async function () {
      await resumeRegistry.connect(admin).pause()
      expect(await resumeRegistry.paused()).to.be.true
    })

    it('Should allow admin to unpause contract', async function () {
      await resumeRegistry.connect(admin).pause()
      await resumeRegistry.connect(admin).unpause()
      expect(await resumeRegistry.paused()).to.be.false
    })

    it('Should not allow non-admin to pause', async function () {
      await expect(
        resumeRegistry.connect(user1).pause()
      ).to.be.revertedWithCustomError(
        resumeRegistry,
        'AccessControlUnauthorizedAccount'
      )
    })

    it('Should prevent resume operations when paused', async function () {
      await resumeRegistry.connect(admin).pause()

      await expect(
        resumeRegistry
          .connect(user1)
          .addResume('QmHash', 'Title', 'file.pdf', true)
      ).to.be.revertedWithCustomError(resumeRegistry, 'EnforcedPause')
    })
  })

  describe('Access Control', function () {
    it('Should check admin role correctly', async function () {
      expect(await resumeRegistry.isAdmin(admin.address)).to.be.true
      expect(await resumeRegistry.isAdmin(user1.address)).to.be.false
    })

    it('Should check verifier role correctly', async function () {
      expect(await resumeRegistry.isVerifier(verifier.address)).to.be.true
      expect(await resumeRegistry.isVerifier(user1.address)).to.be.false
    })
  })

  describe('Edge Cases and Security', function () {
    it('Should revert when getting non-existent resume', async function () {
      await expect(resumeRegistry.getResume(999)).to.be.revertedWith(
        'Resume does not exist'
      )
    })

    it('Should revert when getting non-existent verification', async function () {
      await expect(resumeRegistry.getVerification(999)).to.be.revertedWith(
        'Resume does not exist'
      )
    })

    it('Should revert when updating non-existent resume', async function () {
      await expect(
        resumeRegistry.connect(user1).updateResume(999, 'QmHash', 'Title', true)
      ).to.be.revertedWith('Resume does not exist')
    })

    it('Should revert when verifying non-existent resume', async function () {
      await expect(
        resumeRegistry
          .connect(verifier)
          .verifyResume(999, true, 'QmHash', 'Notes')
      ).to.be.revertedWith('Resume does not exist')
    })

    it('Should handle empty strings correctly', async function () {
      // Test with valid IPFS hash and title but empty filename
      await resumeRegistry
        .connect(user1)
        .addResume('QmValidHash', 'Valid Title', '', true)

      const resume = await resumeRegistry.getResume(1)
      expect(resume.ipfsHash).to.equal('QmValidHash')
      expect(resume.title).to.equal('Valid Title')
      expect(resume.filename).to.equal('')
    })
  })

  describe('Gas Optimization', function () {
    it('Should add multiple resumes efficiently', async function () {
      const tx1 = await resumeRegistry
        .connect(user1)
        .addResume('QmHash1', 'Title1', 'file1.pdf', true)
      const tx2 = await resumeRegistry
        .connect(user1)
        .addResume('QmHash2', 'Title2', 'file2.pdf', false)

      const receipt1 = await tx1.wait()
      const receipt2 = await tx2.wait()

      // Gas usage should be reasonable (less than 300k gas per transaction)
      expect(receipt1.gasUsed).to.be.lessThan(300000)
      expect(receipt2.gasUsed).to.be.lessThan(300000)
    })
  })
})
