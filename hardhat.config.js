require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config({ path: '.env.local' })

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    baseSepolia: {
      url:
        process.env.ALCHEMY_BASE_SEPOLIA_URL ||
        'https://base-sepolia.g.alchemy.com/v2/1EacVcYetgk_QIWCKp4hI',
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 1000000000, // 1 gwei
    },
    baseMainnet: {
      url:
        process.env.NEXT_PUBLIC_ALCHEMY_BASE_MAINNET_URL ||
        'https://base-mainnet.g.alchemy.com/v2/1EacVcYetgk_QIWCKp4hI',
      chainId: 8453,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 1000000000, // 1 gwei
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'baseSepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
    ],
  },
}
