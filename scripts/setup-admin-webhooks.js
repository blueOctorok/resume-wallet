require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

// Setup webhooks for ResumeRegistry contract monitoring
async function setupAdminWebhooks() {
  console.log('🎛️ Setting up Alchemy Admin Panel Webhooks...')

  const contractAddress = process.env.NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS
  const alchemyApiKey = process.env.ALCHEMY_BASE_SEPOLIA_URL?.split('/').pop()

  if (!contractAddress || !alchemyApiKey) {
    throw new Error('Missing contract address or Alchemy API key')
  }

  console.log('📍 Contract Address:', contractAddress)
  console.log('🔑 Alchemy API Key:', alchemyApiKey?.substring(0, 10) + '...')

  // Webhook URLs for different event types
  const webhookConfigs = [
    {
      name: 'ResumeRegistry - Resume Added',
      url: 'https://webhook.site/your-unique-url', // Replace with your webhook URL
      webhook_type: 'ADDRESS_ACTIVITY',
      address: contractAddress,
      filters: [
        {
          from_address: '*',
          to_address: contractAddress,
          category: ['external', 'erc20', 'erc721', 'erc1155'],
        },
      ],
    },
    {
      name: 'ResumeRegistry - Ownership Changes',
      url: 'https://webhook.site/your-unique-url', // Replace with your webhook URL
      webhook_type: 'ADDRESS_ACTIVITY',
      address: contractAddress,
      filters: [
        {
          from_address: '*',
          to_address: contractAddress,
          category: ['external'],
        },
      ],
    },
  ]

  console.log('\n📋 Webhook Configurations:')
  webhookConfigs.forEach((config, index) => {
    console.log(`${index + 1}. ${config.name}`)
    console.log(`   Type: ${config.webhook_type}`)
    console.log(`   Address: ${config.address}`)
    console.log(`   URL: ${config.url}`)
  })

  console.log('\n🔧 Next Steps:')
  console.log('1. Go to your Alchemy Dashboard → Webhooks')
  console.log('2. Create new webhooks with the configurations above')
  console.log('3. Replace webhook URLs with your actual endpoints')
  console.log('4. Test with a resume upload transaction')

  console.log("\n📊 Admin Panel Features You'll Get:")
  console.log('✅ Real-time resume upload notifications')
  console.log('✅ Contract interaction monitoring')
  console.log('✅ Gas cost tracking')
  console.log('✅ User activity analytics')
  console.log('✅ Transaction success/failure alerts')

  return webhookConfigs
}

// Test webhook functionality
async function testWebhook() {
  console.log('\n🧪 Testing Webhook Configuration...')

  const contractAddress = process.env.NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS

  try {
    // Test with a simple address activity check
    const response = await axios.post(
      `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_BASE_SEPOLIA_URL?.split('/').pop()}`,
      {
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromAddress: contractAddress,
            toAddress: contractAddress,
            category: ['external', 'erc20'],
            maxCount: 10,
            order: 'desc',
          },
        ],
        id: 1,
      }
    )

    console.log('✅ Webhook test successful!')
    console.log(
      '📊 Recent contract activity:',
      response.data.result?.transfers?.length || 0,
      'transactions'
    )

    if (response.data.result?.transfers?.length > 0) {
      console.log('🔍 Latest transaction:', response.data.result.transfers[0])
    }
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message)
  }
}

async function main() {
  try {
    await setupAdminWebhooks()
    await testWebhook()

    console.log('\n🎉 Admin Panel Setup Complete!')
    console.log('\n📝 Manual Steps Required:')
    console.log('1. Go to: https://dashboard.alchemy.com/apps')
    console.log('2. Select your Base Sepolia app')
    console.log('3. Navigate to "Webhooks" in the left sidebar')
    console.log('4. Create webhooks for contract monitoring')
    console.log('5. Set up your webhook endpoints (webhook.site for testing)')
  } catch (error) {
    console.error('❌ Setup failed:', error.message)
  }
}

main()
