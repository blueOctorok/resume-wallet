import { PinataSDK } from 'pinata-web3'

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
})

export const uploadToIPFS = async (file: File) => {
  const upload = await pinata.upload.file(file)
  return {
    ipfsHash: upload.IpfsHash,
    url: `${process.env.PINATA_GATEWAY}/ipfs/${upload.IpfsHash}`,
  }
}
