/**
 * Alchemy Webhook Listener
 *
 * Receives real-time notifications from Alchemy when:
 * - Users' transactions are confirmed
 * - Resume verification transactions complete
 * - Contract interactions succeed/fail
 *
 * Keeps it simple - just log and acknowledge
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Types for Alchemy webhook events
interface AlchemyWebhookEvent {
  webhookId: string
  id: string
  createdAt: string
  type: string
  event: {
    network: string
    activity: Array<{
      fromAddress: string
      toAddress: string
      blockNum: string
      hash: string
      value?: number
      asset?: string
      category: string
      rawContract?: {
        rawValue?: string
        address?: string
        decimals?: number
      }
    }>
  }
}

/**
 * Validate webhook signature for security
 */
function isValidSignature(
  body: string,
  signature: string,
  signingKey: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', signingKey)
    hmac.update(body, 'utf8')
    const digest = hmac.digest('hex')
    return signature === digest
  } catch (error) {
    console.error('❌ Signature validation error:', error)
    return false
  }
}

/**
 * Process webhook event - keep it simple
 */
function processWebhookEvent(event: AlchemyWebhookEvent) {
  console.log('📨 Webhook received:', {
    id: event.id,
    type: event.type,
    network: event.event.network,
    activityCount: event.event.activity?.length || 0,
  })

  // Process each activity
  event.event.activity?.forEach((activity, index) => {
    console.log(`📊 Activity ${index + 1}:`, {
      hash: activity.hash,
      from: activity.fromAddress?.slice(0, 8) + '...',
      to: activity.toAddress?.slice(0, 8) + '...',
      category: activity.category,
      asset: activity.asset || 'ETH',
      value: activity.value,
    })

    // Simple notifications based on activity type
    if (activity.category === 'external' || activity.category === 'internal') {
      console.log('✅ Transaction confirmed:', activity.hash)
    }

    if (activity.category === 'erc20') {
      console.log('💰 Token transfer confirmed:', activity.hash)
    }

    // TODO: In the future, we could:
    // - Send push notifications to users
    // - Update database with transaction status
    // - Trigger UI updates via WebSocket
    // - Send email confirmations
    // But for now, just log it
  })
}

/**
 * POST handler for Alchemy webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature validation
    const body = await request.text()
    const signature = request.headers.get('x-alchemy-signature')

    if (!signature) {
      console.error('❌ Missing webhook signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Get signing key from environment
    const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY
    if (!signingKey) {
      console.error('❌ Missing webhook signing key in environment')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Validate signature for security
    if (!isValidSignature(body, signature, signingKey)) {
      console.error('❌ Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse the webhook event
    const webhookEvent: AlchemyWebhookEvent = JSON.parse(body)

    // Process the event
    processWebhookEvent(webhookEvent)

    // Always respond with 200 to acknowledge receipt
    return NextResponse.json(
      {
        message: 'Webhook processed successfully',
        eventId: webhookEvent.id,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('❌ Webhook processing error:', error)

    // Still return 200 to prevent retries for parsing errors
    return NextResponse.json({ error: 'Processing error' }, { status: 200 })
  }
}

/**
 * GET handler for webhook health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    message: 'Alchemy webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  })
}
