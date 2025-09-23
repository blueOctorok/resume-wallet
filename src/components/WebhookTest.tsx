'use client'

import { useState } from 'react'
import {
  createAddressActivityWebhook,
  createContractActivityWebhook,
  listWebhooks,
  deleteWebhook,
  testWebhook,
  getWebhookUrl,
  setupResumeAppWebhooks,
  type WebhookResponse,
} from '@/lib/alchemy-webhooks'

export default function WebhookTest() {
  const [testing, setTesting] = useState(false)
  const [webhooks, setWebhooks] = useState<WebhookResponse[]>([])
  const [results, setResults] = useState<{
    [key: string]: any
  }>({})

  // Test addresses
  const testAddresses = {
    user: '0x1Bf6D9cB33e3Cb3a75e26d6e5F4Efcd8b17A1B32',
    contract: '0x1234567890123456789012345678901234567890', // Example contract
  }

  const handleTest = async (
    testType: string,
    testFunction: () => Promise<any>
  ) => {
    setTesting(true)
    setResults((prev) => ({ ...prev, [testType]: null }))

    try {
      const result = await testFunction()
      setResults((prev) => ({ ...prev, [testType]: result }))
    } catch (error) {
      const errorResult = {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }
      setResults((prev) => ({ ...prev, [testType]: errorResult }))
    } finally {
      setTesting(false)
    }
  }

  // Test 1: Get webhook URL
  const testGetWebhookUrl = async () => {
    const url = getWebhookUrl()
    return { url, success: true }
  }

  // Test 2: List existing webhooks
  const testListWebhooks = async () => {
    const webhookList = await listWebhooks()
    setWebhooks(webhookList)
    return {
      count: webhookList.length,
      webhooks: webhookList.map((w) => ({
        id: w.id,
        type: w.webhookType,
        network: w.network,
        isActive: w.isActive,
      })),
      success: true,
    }
  }

  // Test 3: Create address activity webhook
  const testCreateAddressWebhook = async () => {
    const webhook = await createAddressActivityWebhook(
      [testAddresses.user],
      getWebhookUrl()
    )
    return {
      webhookId: webhook.id,
      signingKey: webhook.signingKey?.slice(0, 20) + '...',
      success: true,
    }
  }

  // Test 4: Create contract activity webhook
  const testCreateContractWebhook = async () => {
    const webhook = await createContractActivityWebhook(
      testAddresses.contract,
      getWebhookUrl()
    )
    return {
      webhookId: webhook.id,
      signingKey: webhook.signingKey?.slice(0, 20) + '...',
      success: true,
    }
  }

  // Test 5: Setup complete webhook system
  const testSetupComplete = async () => {
    const result = await setupResumeAppWebhooks(
      [testAddresses.user],
      testAddresses.contract
    )
    return {
      addressWebhook: result.addressWebhook?.id,
      contractWebhook: result.contractWebhook?.id,
      success: true,
    }
  }

  // Test 6: Test existing webhook
  const testWebhookPing = async () => {
    if (webhooks.length === 0) {
      throw new Error('No webhooks available to test. Create one first.')
    }

    const webhookId = webhooks[0].id
    await testWebhook(webhookId)
    return {
      testedWebhookId: webhookId,
      message: 'Test event sent successfully',
      success: true,
    }
  }

  const renderResult = (testType: string, result: any) => {
    if (!result) return null

    return (
      <div className='mt-4 p-4 border rounded-lg bg-gray-50'>
        <h4 className='font-semibold mb-2'>{testType} Result:</h4>

        {/* Success/Error Status */}
        <div
          className={`mb-2 p-2 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          <strong>Status:</strong> {result.success ? '✅ Success' : '❌ Failed'}
          {result.error && <div>Error: {result.error}</div>}
        </div>

        {/* Result Details */}
        {result.url && (
          <div className='mb-2'>
            <strong>Webhook URL:</strong> {result.url}
          </div>
        )}

        {result.count !== undefined && (
          <div className='mb-2'>
            <strong>Webhook Count:</strong> {result.count}
          </div>
        )}

        {result.webhookId && (
          <div className='mb-2'>
            <strong>Webhook ID:</strong> {result.webhookId}
          </div>
        )}

        {result.signingKey && (
          <div className='mb-2'>
            <strong>Signing Key:</strong> {result.signingKey}
          </div>
        )}

        {result.webhooks && (
          <div className='mb-2'>
            <strong>Webhooks:</strong>
            <div className='mt-1 space-y-1'>
              {result.webhooks.map((webhook: any, index: number) => (
                <div
                  key={index}
                  className='text-sm bg-white p-2 rounded border'
                >
                  <div>
                    <strong>ID:</strong> {webhook.id}
                  </div>
                  <div>
                    <strong>Type:</strong> {webhook.type}
                  </div>
                  <div>
                    <strong>Network:</strong> {webhook.network}
                  </div>
                  <div>
                    <strong>Active:</strong> {webhook.isActive ? '✅' : '❌'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw Response */}
        <details className='mt-2'>
          <summary className='cursor-pointer font-medium'>Raw Response</summary>
          <pre className='mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto'>
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      </div>
    )
  }

  return (
    <div className='max-w-4xl mx-auto p-6'>
      <div className='bg-white rounded-lg shadow-lg p-6'>
        <h2 className='text-2xl font-bold mb-6 text-gray-800'>
          🔗 Alchemy Webhooks Test Suite
        </h2>

        <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
          <h3 className='font-semibold text-blue-800 mb-2'>What This Tests:</h3>
          <ul className='text-blue-700 space-y-1'>
            <li>• Webhook URL generation and configuration</li>
            <li>• Address activity webhooks for user monitoring</li>
            <li>• Contract activity webhooks for ResumeRegistry</li>
            <li>• Webhook management (create, list, test)</li>
            <li>• Complete webhook setup for our app</li>
            <li>• Real-time transaction notifications</li>
          </ul>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
          {/* Test 1: Get Webhook URL */}
          <button
            onClick={() => handleTest('Get Webhook URL', testGetWebhookUrl)}
            disabled={testing}
            className='p-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '🔗 Get Webhook URL'}
          </button>

          {/* Test 2: List Webhooks */}
          <button
            onClick={() => handleTest('List Webhooks', testListWebhooks)}
            disabled={testing}
            className='p-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '📋 List Webhooks'}
          </button>

          {/* Test 3: Create Address Webhook */}
          <button
            onClick={() =>
              handleTest('Create Address Webhook', testCreateAddressWebhook)
            }
            disabled={testing}
            className='p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '👤 Create Address Webhook'}
          </button>

          {/* Test 4: Create Contract Webhook */}
          <button
            onClick={() =>
              handleTest('Create Contract Webhook', testCreateContractWebhook)
            }
            disabled={testing}
            className='p-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '📄 Create Contract Webhook'}
          </button>

          {/* Test 5: Complete Setup */}
          <button
            onClick={() => handleTest('Complete Setup', testSetupComplete)}
            disabled={testing}
            className='p-4 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '🚀 Complete Setup'}
          </button>

          {/* Test 6: Test Webhook */}
          <button
            onClick={() => handleTest('Test Webhook', testWebhookPing)}
            disabled={testing}
            className='p-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '🧪 Test Webhook'}
          </button>
        </div>

        {/* Configuration Info */}
        <div className='mb-6 p-4 bg-gray-50 rounded-lg'>
          <h3 className='font-semibold mb-2'>Configuration:</h3>
          <div className='text-sm space-y-1'>
            <div>
              <strong>Test User:</strong> {testAddresses.user}
            </div>
            <div>
              <strong>Test Contract:</strong> {testAddresses.contract}
            </div>
            <div>
              <strong>Network:</strong> Base Sepolia
            </div>
            <div>
              <strong>Webhook Endpoint:</strong> /api/webhooks/alchemy
            </div>
          </div>
        </div>

        {/* Results */}
        <div className='space-y-4'>
          {Object.entries(results).map(([testType, result]) => (
            <div key={testType}>{renderResult(testType, result)}</div>
          ))}
        </div>

        {/* Environment Variables Needed */}
        <div className='mt-6 p-4 bg-yellow-50 rounded-lg'>
          <h3 className='font-semibold text-yellow-800 mb-2'>
            Required Environment Variables:
          </h3>
          <div className='text-yellow-700 text-sm space-y-1'>
            <div>
              <code>ALCHEMY_AUTH_TOKEN</code> - From Alchemy dashboard for
              webhook management
            </div>
            <div>
              <code>ALCHEMY_WEBHOOK_SIGNING_KEY</code> - For webhook signature
              validation
            </div>
            <div>
              <code>NEXT_PUBLIC_APP_URL</code> - Your app's public URL for
              webhook endpoint
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
