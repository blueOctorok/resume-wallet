/**
 * Alchemy Webhooks Management
 *
 * Simple webhook creation and management for:
 * - Address Activity (user wallet monitoring)
 * - Contract Activity (ResumeRegistry monitoring)
 *
 * Keeps it focused on our core needs
 */

// Webhook types we'll use
export type WebhookType = 'ADDRESS_ACTIVITY' | 'CUSTOM_WEBHOOK'

// Webhook configuration
export interface WebhookConfig {
  type: WebhookType
  network: 'BASE_SEPOLIA' | 'BASE_MAINNET'
  webhookUrl: string
  addresses?: string[]
  contractAddress?: string
  description?: string
}

// Webhook response from Alchemy API
export interface WebhookResponse {
  id: string
  network: string
  webhookType: string
  webhookUrl: string
  isActive: boolean
  timeCreated: string
  signingKey: string
  version: string
  addresses?: string[]
}

/**
 * Create a webhook using Alchemy's API
 */
export async function createWebhook(
  config: WebhookConfig
): Promise<WebhookResponse> {
  const ALCHEMY_API_KEY =
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
  const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN

  if (!ALCHEMY_AUTH_TOKEN) {
    throw new Error('ALCHEMY_AUTH_TOKEN is required for webhook management')
  }

  const url = 'https://dashboard.alchemy.com/api/create-webhook'

  // Build request body based on webhook type
  let requestBody: any = {
    network: config.network,
    webhook_type: config.type,
    webhook_url: config.webhookUrl,
  }

  if (config.type === 'ADDRESS_ACTIVITY' && config.addresses) {
    requestBody.addresses = config.addresses
  }

  if (config.type === 'CUSTOM_WEBHOOK' && config.contractAddress) {
    requestBody.filters = [
      {
        contract_address: config.contractAddress,
        topics: [], // Listen to all events from this contract
      },
    ]
  }

  console.log('🔗 Creating webhook:', requestBody)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Webhook creation failed: ${response.status} ${errorText}`
      )
    }

    const webhookData = await response.json()
    console.log('✅ Webhook created:', webhookData)

    return webhookData
  } catch (error) {
    console.error('❌ Webhook creation error:', error)
    throw error
  }
}

/**
 * Create address activity webhook for user wallet monitoring
 */
export async function createAddressActivityWebhook(
  userAddresses: string[],
  webhookUrl: string,
  network: 'BASE_SEPOLIA' | 'BASE_MAINNET' = 'BASE_SEPOLIA'
): Promise<WebhookResponse> {
  return createWebhook({
    type: 'ADDRESS_ACTIVITY',
    network,
    webhookUrl,
    addresses: userAddresses,
    description: 'Monitor user wallet activity for resume verification app',
  })
}

/**
 * Create contract activity webhook for ResumeRegistry monitoring
 */
export async function createContractActivityWebhook(
  contractAddress: string,
  webhookUrl: string,
  network: 'BASE_SEPOLIA' | 'BASE_MAINNET' = 'BASE_SEPOLIA'
): Promise<WebhookResponse> {
  return createWebhook({
    type: 'CUSTOM_WEBHOOK',
    network,
    webhookUrl,
    contractAddress,
    description: 'Monitor ResumeRegistry contract for verification events',
  })
}

/**
 * List all webhooks for this app
 */
export async function listWebhooks(): Promise<WebhookResponse[]> {
  const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN

  if (!ALCHEMY_AUTH_TOKEN) {
    throw new Error('ALCHEMY_AUTH_TOKEN is required for webhook management')
  }

  const url = 'https://dashboard.alchemy.com/api/team-webhooks'

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to list webhooks: ${response.status}`)
    }

    const data = await response.json()
    console.log('📋 Webhooks listed:', data.data?.length || 0)

    return data.data || []
  } catch (error) {
    console.error('❌ List webhooks error:', error)
    throw error
  }
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(webhookId: string): Promise<boolean> {
  const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN

  if (!ALCHEMY_AUTH_TOKEN) {
    throw new Error('ALCHEMY_AUTH_TOKEN is required for webhook management')
  }

  const url = `https://dashboard.alchemy.com/api/delete-webhook`

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
      },
      body: JSON.stringify({ webhook_id: webhookId }),
    })

    if (!response.ok) {
      throw new Error(`Failed to delete webhook: ${response.status}`)
    }

    console.log('🗑️ Webhook deleted:', webhookId)
    return true
  } catch (error) {
    console.error('❌ Delete webhook error:', error)
    throw error
  }
}

/**
 * Test webhook by sending a test event
 */
export async function testWebhook(webhookId: string): Promise<boolean> {
  const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN

  if (!ALCHEMY_AUTH_TOKEN) {
    throw new Error('ALCHEMY_AUTH_TOKEN is required for webhook management')
  }

  const url = `https://dashboard.alchemy.com/api/test-webhook`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
      },
      body: JSON.stringify({ webhook_id: webhookId }),
    })

    if (!response.ok) {
      throw new Error(`Failed to test webhook: ${response.status}`)
    }

    console.log('🧪 Webhook test sent:', webhookId)
    return true
  } catch (error) {
    console.error('❌ Test webhook error:', error)
    throw error
  }
}

/**
 * Get webhook URL for our app
 */
export function getWebhookUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/api/webhooks/alchemy`
}

/**
 * Simple webhook setup for our resume verification app
 */
export async function setupResumeAppWebhooks(
  userAddresses: string[],
  contractAddress?: string
): Promise<{
  addressWebhook?: WebhookResponse
  contractWebhook?: WebhookResponse
}> {
  const webhookUrl = getWebhookUrl()
  const results: any = {}

  try {
    // Create address activity webhook for user monitoring
    if (userAddresses.length > 0) {
      console.log('🔗 Setting up address activity webhook...')
      results.addressWebhook = await createAddressActivityWebhook(
        userAddresses,
        webhookUrl
      )
    }

    // Create contract activity webhook if we have a deployed contract
    if (contractAddress) {
      console.log('🔗 Setting up contract activity webhook...')
      results.contractWebhook = await createContractActivityWebhook(
        contractAddress,
        webhookUrl
      )
    }

    console.log('✅ Webhook setup complete')
    return results
  } catch (error) {
    console.error('❌ Webhook setup failed:', error)
    throw error
  }
}
