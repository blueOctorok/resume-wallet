import { NextRequest, NextResponse } from 'next/server'
import { sendUSDCPayment, parsePaymentRequirements } from '@/lib/x402-payment'

// Allow up to 60s so T Backend + payment retries can complete (requires Vercel Pro)
export const maxDuration = 60

const T_BACKEND_API_KEY = process.env.T_BACKEND_API_KEY
const T_BACKEND_BASE_URL =
  process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'

/**
 * POST /api/ai/chat
 *
 * Proxy to T Backend chat endpoint with automatic x402 payment handling
 * Input: message, session_id (optional)
 * Output: reply from T Backend
 */
export async function POST(request: NextRequest) {
  try {
    // Note: With X-Partner: pace_drivers, api-key may not be required
    // The team's format doesn't include it, so we make it optional

    // Parse request body
    const body = await request.json()
    const { message, session_id, system } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid message field' },
        { status: 400 }
      )
    }

    // Get user's wallet address from request header (for tracking user context)
    const userWalletAddress =
      request.headers.get('x-wallet-address') ||
      request.headers.get('X-Wallet-Address')

    // For Pace Drivers x402 payment, use the PAYMENT wallet address (not user's wallet)
    // This is the wallet that pays and receives credits
    const { privateKeyToAccount } = await import('viem/accounts')
    const paymentKey =
      process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY
    const normalizedKey = paymentKey?.startsWith('0x')
      ? paymentKey
      : `0x${paymentKey}`
    const paymentAccount = privateKeyToAccount(normalizedKey as `0x${string}`)
    const paymentWalletAddress = paymentAccount.address

    console.log('💬 [AI CHAT] Sending message to T Backend')
    console.log(`   Message: ${message.substring(0, 100)}...`)
    console.log(`   Session ID: ${session_id || 'none'}`)
    console.log(`   User Wallet: ${userWalletAddress || 'none'}`)
    console.log(`   Payment Wallet: ${paymentWalletAddress}`)

    // Call T Backend chat API with Pace Drivers partner header
    const tBackendUrl = `${T_BACKEND_BASE_URL}/chat`
    const tBackendPayload: any = {
      message,
    }

    // Add session_id if provided
    if (session_id) {
      tBackendPayload.session_id = session_id
    }

    // Add system prompt if provided
    if (system) {
      tBackendPayload.system = system
    }

    // Build headers - match team's format exactly
    // Team's curl doesn't include api-key, so we don't send it with X-Partner
    const headers: Record<string, string> = {
      'X-Partner': 'pace_drivers',
      'X-Wallet-Address': paymentWalletAddress, // Payment wallet (tracks credits)
      'Content-Type': 'application/json',
    }

    // Note: Not sending api-key header - team's format doesn't include it
    // X-Partner: pace_drivers may handle authentication differently

    // Make initial request with X-Partner header to trigger payment flow
    // Add timeout to prevent Vercel function timeout (504)
    // With maxDuration=60 on Pro, we can allow up to 50s for T Backend
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 50000) // 50s timeout

    let tBackendResponse: Response
    try {
      tBackendResponse = await fetch(tBackendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(tBackendPayload),
        signal: controller.signal,
      })
    } catch (fetchError: unknown) {
      clearTimeout(timeout)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('❌ [AI CHAT] T Backend request timed out (25s)')
        return NextResponse.json(
          {
            error:
              'AI service is taking too long to respond. Please try again.',
          },
          { status: 504 }
        )
      }
      throw fetchError
    }
    clearTimeout(timeout)

    // Automatic payments ENABLED - Credits working as of Dec 9, 2025
    // Team fixed credit activation system and pricing
    // Pricing: 0.026 USDC per 50 credit batch = $0.00052 per request
    // Amount is dynamically read from backend response (amountUnits field)
    const AUTO_PAYMENT_ENABLED = true

    // Handle payment required - can be 401 or 402 status
    // Check if response indicates payment is required
    const responseClone = tBackendResponse.clone()
    const responseData = await responseClone.json().catch(() => ({}))
    const isPaymentRequired =
      tBackendResponse.status === 402 ||
      (tBackendResponse.status === 401 &&
        responseData?.detail?.includes('Payment required'))

    if (isPaymentRequired && AUTO_PAYMENT_ENABLED) {
      console.log(
        `💳 [AI CHAT] Payment required (${tBackendResponse.status}), processing payment...`
      )
      console.log(
        `📋 [AI CHAT] Response body:`,
        JSON.stringify(responseData, null, 2)
      )

      try {
        const paymentRequirements = parsePaymentRequirements(responseData)

        if (!paymentRequirements) {
          console.error(
            '❌ [AI CHAT] Could not parse payment requirements from 402 response'
          )
          return NextResponse.json(
            { error: 'Payment required but payment details are invalid' },
            { status: 402 }
          )
        }

        console.log('💳 [AI CHAT] Payment requirements:', paymentRequirements)

        // Send USDC payment
        const paymentResult = await sendUSDCPayment(paymentRequirements)
        console.log(`✅ [AI CHAT] Payment successful: ${paymentResult.txHash}`)

        // Retry original request with payment proof (Pace Drivers format)
        console.log('🔄 [AI CHAT] Retrying request with payment proof...')
        const retryHeaders: Record<string, string> = {
          'X-Partner': 'pace_drivers',
          'X-Payment': paymentResult.txHash,
          'Content-Type': 'application/json',
        }

        // Add X-Invoice-Id if provided
        if (paymentRequirements.invoiceId) {
          retryHeaders['X-Invoice-Id'] = paymentRequirements.invoiceId
          console.log(`   Invoice ID: ${paymentRequirements.invoiceId}`)
        }

        console.log(`   Payment Tx: ${paymentResult.txHash}`)

        // Note: Not sending api-key - matches team's format

        // Add payment wallet address (same as initial request)
        retryHeaders['X-Wallet-Address'] = paymentWalletAddress

        // Retry with payment proof - backend may need time to verify on-chain
        // Payment status can be: pending -> submitted -> verified
        // Use shorter timeout for retries to stay within Vercel limits
        const retryController = new AbortController()
        const retryTimeout = setTimeout(() => retryController.abort(), 15000)

        let retryResponse: Response
        try {
          retryResponse = await fetch(tBackendUrl, {
            method: 'POST',
            headers: retryHeaders,
            body: JSON.stringify(tBackendPayload),
            signal: retryController.signal,
          })
        } catch (retryFetchError: unknown) {
          clearTimeout(retryTimeout)
          if (
            retryFetchError instanceof Error &&
            retryFetchError.name === 'AbortError'
          ) {
            return NextResponse.json(
              {
                error: 'AI service timed out after payment. Try again shortly.',
                paymentTxHash: paymentResult.txHash,
              },
              { status: 504 }
            )
          }
          throw retryFetchError
        }
        clearTimeout(retryTimeout)

        // Handle payment verification states - reduced retries for Vercel timeout
        // 4 retries * 2s = 8s max additional wait
        const maxRetries = 4
        let retryCount = 0

        while (retryResponse.status === 402 && retryCount < maxRetries) {
          const retryData = await retryResponse.json().catch(() => ({}))
          const status = retryData?.detail?.status
          console.log(
            `📋 [AI CHAT] Retry response (${retryCount}):`,
            JSON.stringify(retryData, null, 2)
          )

          if (status === 'pending' || status === 'submitted') {
            retryCount++
            const waitTime = 2000 // 2s wait between retries (8s total max)
            console.log(
              `⏳ [AI CHAT] Payment status: ${status}, waiting ${waitTime}ms before retry ${retryCount}/${maxRetries}...`
            )

            await new Promise((resolve) => setTimeout(resolve, waitTime))

            console.log(
              `🔄 [AI CHAT] Retrying after payment verification delay...`
            )

            const loopController = new AbortController()
            const loopTimeout = setTimeout(() => loopController.abort(), 10000)
            try {
              retryResponse = await fetch(tBackendUrl, {
                method: 'POST',
                headers: retryHeaders,
                body: JSON.stringify(tBackendPayload),
                signal: loopController.signal,
              })
            } finally {
              clearTimeout(loopTimeout)
            }
          } else {
            // Status changed (likely verified or error)
            console.log(
              `✅ [AI CHAT] Payment status changed to: ${status || 'unknown'}`
            )
            break
          }
        }

        if (!retryResponse.ok) {
          const retryError = await retryResponse
            .json()
            .catch(() => retryResponse.text())
          console.error('❌ [AI CHAT] Retry after payment failed:', retryError)

          // If still pending/submitted after all retries, give user helpful message
          const finalStatus = retryError?.detail?.status
          if (
            retryResponse.status === 402 &&
            (finalStatus === 'pending' || finalStatus === 'submitted')
          ) {
            return NextResponse.json(
              {
                error:
                  'Payment sent but verification is taking longer than expected. Please try again in a moment.',
                detail: `Payment transaction confirmed on-chain (${paymentResult.txHash}), but backend verification is ${finalStatus}`,
                paymentTxHash: paymentResult.txHash,
                invoiceId: paymentRequirements.invoiceId,
              },
              { status: 202 } // 202 Accepted - payment sent, processing
            )
          }

          return NextResponse.json(
            {
              error: 'Payment completed but request failed',
              detail: retryError,
            },
            { status: retryResponse.status }
          )
        }

        // Parse successful retry response
        const retryData = await retryResponse.json()
        console.log('✅ [AI CHAT] Request successful after payment')
        console.log(`   Reply length: ${retryData.reply?.length || 0} chars`)

        return NextResponse.json({
          success: true,
          reply: retryData.reply || retryData.message || 'No response received',
          session_id: retryData.session_id || session_id,
          paymentTxHash: paymentResult.txHash, // Include payment proof for reference
        })
      } catch (paymentError: any) {
        console.error('❌ [AI CHAT] Payment processing failed:', paymentError)
        return NextResponse.json(
          {
            error: 'Payment processing failed',
            detail: paymentError.message || 'Could not complete payment',
          },
          { status: 500 }
        )
      }
    }

    // Handle other T Backend errors
    if (!tBackendResponse.ok) {
      const errorText = await tBackendResponse.text()
      let errorDetail = errorText

      try {
        const errorJson = JSON.parse(errorText)
        errorDetail = errorJson.detail || errorJson.error || errorText
        console.error('❌ [AI CHAT] T Backend error JSON:', errorJson)
      } catch {
        console.error('❌ [AI CHAT] T Backend error (non-JSON):', errorText)
      }

      console.error('❌ [AI CHAT] T Backend error summary:', {
        status: tBackendResponse.status,
        statusText: tBackendResponse.statusText,
        detail: errorDetail,
        url: tBackendUrl,
      })

      // Map common errors to user-friendly messages
      let userMessage = 'Failed to get AI response'

      if (tBackendResponse.status === 400) {
        userMessage = 'Invalid message format'
      } else if (tBackendResponse.status === 401) {
        if (
          errorDetail.includes('expired') ||
          errorDetail.includes('API Key')
        ) {
          userMessage =
            'API key has expired. Please contact the team for a new key.'
        } else {
          userMessage = 'AI service authentication failed'
        }
      } else if (tBackendResponse.status === 429) {
        userMessage = 'Rate limit exceeded. Please try again in a moment.'
      } else if (tBackendResponse.status === 502) {
        userMessage =
          'AI service is temporarily unavailable. Please try again in a moment.'
      } else if (tBackendResponse.status === 503) {
        userMessage =
          'AI service is temporarily unavailable. Please try again in a moment.'
      } else if (tBackendResponse.status === 500) {
        userMessage = 'AI service error. Please try again.'
      }

      // If payment required but auto-payment is disabled, return helpful error
      if (isPaymentRequired && !AUTO_PAYMENT_ENABLED) {
        return NextResponse.json(
          {
            error: 'Payment required - automatic payment is currently disabled',
            detail:
              'Please contact support. Automatic payment has been temporarily disabled due to cost issues.',
            requiresPayment: true,
          },
          { status: 402 }
        )
      }

      return NextResponse.json(
        { error: userMessage, detail: errorDetail },
        { status: tBackendResponse.status }
      )
    }

    // Parse successful response (no payment required)
    const tBackendData = await tBackendResponse.json()

    console.log('✅ [AI CHAT] T Backend response received')
    console.log(`   Reply length: ${tBackendData.reply?.length || 0} chars`)
    console.log(`   Session ID: ${tBackendData.session_id || 'none'}`)

    return NextResponse.json({
      success: true,
      reply:
        tBackendData.reply || tBackendData.message || 'No response received',
      session_id: tBackendData.session_id || session_id,
    })
  } catch (error: any) {
    console.error('❌ [AI CHAT] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while processing your message',
        detail: error.message,
      },
      { status: 500 }
    )
  }
}
