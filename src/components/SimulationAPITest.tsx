'use client'

import { useState } from 'react'
import {
  simulateTransaction,
  simulateContractDeployment,
  simulateResumeVerification,
  simulateUSDCTransfer,
  simulateTransactionRaw,
  formatAssetChanges,
  estimateTransactionCostUSD,
  validateTransaction,
  type TransactionRequest,
  type SimulationResult,
  type AssetChange,
} from '@/lib/alchemy-simulation-api'

interface SimulationTestResult extends SimulationResult {
  estimatedCostUSD?: number
  deploymentAddress?: string
  formattedChanges?: string[]
  validationErrors?: string[]
  gasAnalysis?: any
  complexity?: any
  officialCompliance?: any
}

export default function SimulationAPITest() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<{
    [key: string]: SimulationTestResult | null
  }>({})

  // Test addresses (Base Sepolia)
  const testAddresses = {
    user: '0x1Bf6D9cB33e3Cb3a75e26d6e5F4Efcd8b17A1B32', // Your test address
    recipient: '0x742d35Cc6634C0532925a3b8D0C9e3e0C0C0C0C0', // Example recipient
    usdcContract: '0x036cbd53842c5426634e7929541ec2318f3dcf7e', // Base Sepolia USDC
  }

  const handleTest = async (
    testType: string,
    testFunction: () => Promise<SimulationTestResult>
  ) => {
    setTesting(true)
    setResults((prev) => ({ ...prev, [testType]: null }))

    try {
      const result = await testFunction()
      setResults((prev) => ({ ...prev, [testType]: result }))
    } catch (error) {
      const errorResult: SimulationTestResult = {
        changes: [],
        gasUsed: '0x0',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
      setResults((prev) => ({ ...prev, [testType]: errorResult }))
    } finally {
      setTesting(false)
    }
  }

  // Test 1: Simple ETH Transfer Simulation
  const testETHTransfer = async (): Promise<SimulationTestResult> => {
    const transaction: TransactionRequest = {
      from: testAddresses.user,
      to: testAddresses.recipient,
      value: '0x16345785D8A0000', // 0.1 ETH in hex
    }

    const validation = validateTransaction(transaction)
    const result = await simulateTransaction(transaction)

    return {
      ...result,
      formattedChanges: formatAssetChanges(result.changes),
      validationErrors: validation.valid ? [] : validation.errors,
    }
  }

  // Test 2: USDC Transfer Simulation
  const testUSDCTransfer = async (): Promise<SimulationTestResult> => {
    const result = await simulateUSDCTransfer({
      from: testAddresses.user,
      to: testAddresses.recipient,
      amount: '10.50', // $10.50 USDC
    })

    return {
      ...result,
      formattedChanges: formatAssetChanges(result.changes),
    }
  }

  // Test 3: Contract Deployment Simulation
  const testContractDeployment = async (): Promise<SimulationTestResult> => {
    // Simple contract bytecode (example - would be actual ResumeRegistry bytecode)
    const contractBytecode = '0x608060405234801561001057600080fd5b50600080fd5b'

    const result = await simulateContractDeployment({
      from: testAddresses.user,
      contractBytecode,
      value: '0x0',
    })

    let estimatedCostUSD: number | undefined
    if (result.success && result.gasUsed) {
      estimatedCostUSD = await estimateTransactionCostUSD(result.gasUsed)
    }

    return {
      ...result,
      estimatedCostUSD,
      formattedChanges: formatAssetChanges(result.changes),
    }
  }

  // Test 4: Resume Verification Simulation
  const testResumeVerification = async (): Promise<SimulationTestResult> => {
    const result = await simulateResumeVerification({
      from: testAddresses.user,
      contractAddress: '0x1234567890123456789012345678901234567890', // Example contract
      resumeHash:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      userAddress: testAddresses.user,
    })

    return {
      ...result,
      formattedChanges: formatAssetChanges(result.changes),
    }
  }

  // Test 5: Raw API Call (Based on Official Alchemy Examples)
  const testRawSimulation = async (): Promise<SimulationTestResult> => {
    // Using exact data structure from Alchemy's official examples
    const transaction: TransactionRequest = {
      from: testAddresses.user,
      to: testAddresses.usdcContract,
      value: '0x0',
      // Official Alchemy example: transfer 1 USDC (1000000 raw units for 6 decimals)
      data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d0c9e3e0c0c0c0c000000000000000000000000000000000000000000000000000000000000f4240',
    }

    console.log('🔧 Testing with official Alchemy example structure')
    const result = await simulateTransactionRaw(transaction)

    return {
      ...result,
      formattedChanges: formatAssetChanges(result.changes),
    }
  }

  // Test 6: Invalid Transaction (Error Testing)
  const testInvalidTransaction = async (): Promise<SimulationTestResult> => {
    const transaction: TransactionRequest = {
      from: 'invalid-address',
      to: testAddresses.recipient,
      value: 'invalid-value',
    }

    const validation = validateTransaction(transaction)

    if (!validation.valid) {
      return {
        changes: [],
        gasUsed: '0x0',
        error: 'Validation failed',
        success: false,
        validationErrors: validation.errors,
      }
    }

    const result = await simulateTransaction(transaction)
    return {
      ...result,
      formattedChanges: formatAssetChanges(result.changes),
    }
  }

  // Test 7: Gas Comparison (Based on Alchemy Examples)
  const testGasComparison = async (): Promise<SimulationTestResult> => {
    console.log('⛽ Testing gas patterns from official Alchemy examples')

    // Test simple ETH transfer (should be ~21000 gas or 0x5208)
    const ethTransfer: TransactionRequest = {
      from: testAddresses.user,
      to: testAddresses.recipient,
      value: '0xDE0B6B3A7640000', // 1 ETH like in examples
    }

    const result = await simulateTransaction(ethTransfer)

    // Add gas analysis
    const gasUsedDecimal = parseInt(result.gasUsed, 16)
    const gasAnalysis = {
      simple_transfer_expected: '~21,000 gas (0x5208)',
      actual_gas_used: `${gasUsedDecimal.toLocaleString()} gas (${result.gasUsed})`,
      gas_efficiency:
        gasUsedDecimal <= 21000 ? 'Efficient' : 'Higher than expected',
    }

    return {
      ...result,
      formattedChanges: formatAssetChanges(result.changes),
      gasAnalysis,
    }
  }

  // Test 8: Multiple Asset Changes (Like WETH Wrap/Unwrap)
  const testMultiAssetChanges = async (): Promise<SimulationTestResult> => {
    console.log('🔄 Testing complex transaction with multiple asset changes')

    // Simulate a transaction that would cause multiple asset changes
    // This is a mock of what a WETH wrap would look like on Base
    const complexTransaction: TransactionRequest = {
      from: testAddresses.user,
      to: '0x4200000000000000000000000000000000000006', // Base WETH contract
      value: '0x16345785D8A0000', // 0.1 ETH
      data: '0xd0e30db0', // deposit() function selector for WETH
    }

    const result = await simulateTransaction(complexTransaction)

    // Analyze the complexity
    const complexity = {
      asset_changes_count: result.changes.length,
      involves_native_token: result.changes.some(
        (c) => c.assetType === 'NATIVE'
      ),
      involves_erc20: result.changes.some((c) => c.assetType === 'ERC20'),
      transaction_type:
        result.changes.length > 1 ? 'Complex (Multi-asset)' : 'Simple',
    }

    return {
      ...result,
      formattedChanges: formatAssetChanges(result.changes),
      complexity,
    }
  }

  // Test 9: Official Alchemy Example (Exact Replication)
  const testOfficialAlchemyExample =
    async (): Promise<SimulationTestResult> => {
      console.log('📋 Testing exact official Alchemy example from docs')

      // This is the EXACT transaction from Alchemy's official documentation
      const officialTransaction: TransactionRequest = {
        from: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', // vitalik.eth
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC contract (Ethereum)
        data: '0xa9059cbb000000000000000000000000fc43f5f9dd45258b3aff31bdbe6561d97e8b71de00000000000000000000000000000000000000000000000000000000000f4240',
        gas: '0x5208', // 21,000 gas limit
        gasPrice: '0x3b9aca00', // 1 gwei
      }

      // Use raw API to match the official example exactly
      const result = await simulateTransactionRaw(officialTransaction)

      // Analyze compliance with official example
      const officialCompliance = {
        expected_gas_used: '0x5208 (21,000 gas)',
        actual_gas_used: result.gasUsed,
        gas_matches_expected: result.gasUsed === '0x5208',
        expected_asset_type: 'ERC20',
        actual_asset_type: result.changes[0]?.assetType,
        expected_amount: '1 USDC',
        actual_amount:
          result.changes[0]?.amount + ' ' + result.changes[0]?.symbol,
        expected_decimals: 6,
        actual_decimals: result.changes[0]?.decimals,
        full_compliance:
          result.gasUsed === '0x5208' &&
          result.changes[0]?.assetType === 'ERC20' &&
          result.changes[0]?.amount === '1' &&
          result.changes[0]?.symbol === 'USDC',
      }

      return {
        ...result,
        formattedChanges: formatAssetChanges(result.changes),
        officialCompliance,
      }
    }

  const renderResult = (
    testType: string,
    result: SimulationTestResult | null
  ) => {
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

        {/* Validation Errors */}
        {result.validationErrors && result.validationErrors.length > 0 && (
          <div className='mb-2 p-2 rounded bg-yellow-100 text-yellow-800'>
            <strong>Validation Errors:</strong>
            <ul className='list-disc list-inside'>
              {result.validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Gas Usage */}
        <div className='mb-2'>
          <strong>Gas Used:</strong>{' '}
          {parseInt(result.gasUsed, 16).toLocaleString()} gas ({result.gasUsed})
        </div>

        {/* Estimated Cost */}
        {result.estimatedCostUSD && (
          <div className='mb-2'>
            <strong>Estimated Cost:</strong> $
            {result.estimatedCostUSD.toFixed(4)} USD
          </div>
        )}

        {/* Gas Analysis */}
        {result.gasAnalysis && (
          <div className='mb-2 p-2 rounded bg-blue-50'>
            <strong>Gas Analysis:</strong>
            <div className='text-sm mt-1 space-y-1'>
              <div>
                <strong>Expected:</strong>{' '}
                {result.gasAnalysis.simple_transfer_expected}
              </div>
              <div>
                <strong>Actual:</strong> {result.gasAnalysis.actual_gas_used}
              </div>
              <div>
                <strong>Efficiency:</strong> {result.gasAnalysis.gas_efficiency}
              </div>
            </div>
          </div>
        )}

        {/* Complexity Analysis */}
        {result.complexity && (
          <div className='mb-2 p-2 rounded bg-purple-50'>
            <strong>Transaction Complexity:</strong>
            <div className='text-sm mt-1 space-y-1'>
              <div>
                <strong>Asset Changes:</strong>{' '}
                {result.complexity.asset_changes_count}
              </div>
              <div>
                <strong>Native Token:</strong>{' '}
                {result.complexity.involves_native_token ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>ERC20 Tokens:</strong>{' '}
                {result.complexity.involves_erc20 ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Type:</strong> {result.complexity.transaction_type}
              </div>
            </div>
          </div>
        )}

        {/* Official Compliance Analysis */}
        {result.officialCompliance && (
          <div
            className={`mb-2 p-2 rounded ${result.officialCompliance.full_compliance ? 'bg-green-50' : 'bg-yellow-50'}`}
          >
            <strong>Official Alchemy Example Compliance:</strong>
            <div className='text-sm mt-1 space-y-1'>
              <div>
                <strong>Expected Gas:</strong>{' '}
                {result.officialCompliance.expected_gas_used}
              </div>
              <div>
                <strong>Actual Gas:</strong>{' '}
                {result.officialCompliance.actual_gas_used}
              </div>
              <div>
                <strong>Gas Match:</strong>{' '}
                {result.officialCompliance.gas_matches_expected
                  ? '✅ Yes'
                  : '❌ No'}
              </div>
              <div>
                <strong>Expected Amount:</strong>{' '}
                {result.officialCompliance.expected_amount}
              </div>
              <div>
                <strong>Actual Amount:</strong>{' '}
                {result.officialCompliance.actual_amount}
              </div>
              <div>
                <strong>Full Compliance:</strong>{' '}
                {result.officialCompliance.full_compliance
                  ? '✅ Perfect Match'
                  : '⚠️ Differences Found'}
              </div>
            </div>
          </div>
        )}

        {/* Asset Changes */}
        {result.changes.length > 0 && (
          <div className='mb-2'>
            <strong>Asset Changes ({result.changes.length}):</strong>
            <div className='mt-1 space-y-1'>
              {result.formattedChanges?.map((change, index) => (
                <div
                  key={index}
                  className='text-sm bg-white p-2 rounded border'
                >
                  {change}
                </div>
              )) ||
                result.changes.map((change, index) => (
                  <div
                    key={index}
                    className='text-sm bg-white p-2 rounded border'
                  >
                    <div>
                      <strong>Type:</strong> {change.assetType} -{' '}
                      {change.changeType}
                    </div>
                    <div>
                      <strong>Asset:</strong> {change.amount} {change.symbol}
                    </div>
                    <div>
                      <strong>From:</strong> {change.from}
                    </div>
                    <div>
                      <strong>To:</strong> {change.to}
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
          🧪 Alchemy Simulation API Test Suite
        </h2>

        <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
          <h3 className='font-semibold text-blue-800 mb-2'>What This Tests:</h3>
          <ul className='text-blue-700 space-y-1'>
            <li>• Transaction cost estimation before sending</li>
            <li>• Asset change previews (what tokens will move)</li>
            <li>• Contract deployment simulation</li>
            <li>• Resume verification transaction preview</li>
            <li>• Error detection and validation</li>
            <li>• Raw API vs SDK comparison</li>
            <li>• Gas usage patterns (based on official Alchemy examples)</li>
            <li>• Complex multi-asset transactions (WETH-style)</li>
            <li>
              • Exact replication of official Alchemy documentation examples
            </li>
          </ul>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
          {/* Test 1: ETH Transfer */}
          <button
            onClick={() => handleTest('ETH Transfer', testETHTransfer)}
            disabled={testing}
            className='p-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '🔄 Test ETH Transfer'}
          </button>

          {/* Test 2: USDC Transfer */}
          <button
            onClick={() => handleTest('USDC Transfer', testUSDCTransfer)}
            disabled={testing}
            className='p-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '💰 Test USDC Transfer'}
          </button>

          {/* Test 3: Contract Deployment */}
          <button
            onClick={() =>
              handleTest('Contract Deployment', testContractDeployment)
            }
            disabled={testing}
            className='p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '🏗️ Test Contract Deployment'}
          </button>

          {/* Test 4: Resume Verification */}
          <button
            onClick={() =>
              handleTest('Resume Verification', testResumeVerification)
            }
            disabled={testing}
            className='p-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '📄 Test Resume Verification'}
          </button>

          {/* Test 5: Raw API */}
          <button
            onClick={() => handleTest('Raw API Call', testRawSimulation)}
            disabled={testing}
            className='p-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '🔧 Test Raw API'}
          </button>

          {/* Test 6: Error Testing */}
          <button
            onClick={() =>
              handleTest('Invalid Transaction', testInvalidTransaction)
            }
            disabled={testing}
            className='p-4 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '❌ Test Error Handling'}
          </button>

          {/* Test 7: Gas Comparison */}
          <button
            onClick={() => handleTest('Gas Comparison', testGasComparison)}
            disabled={testing}
            className='p-4 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '⛽ Test Gas Patterns'}
          </button>

          {/* Test 8: Multiple Asset Changes */}
          <button
            onClick={() =>
              handleTest('Multi-Asset Changes', testMultiAssetChanges)
            }
            disabled={testing}
            className='p-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '🔄 Test Complex Transaction'}
          </button>

          {/* Test 9: Official Alchemy Example */}
          <button
            onClick={() =>
              handleTest('Official Example', testOfficialAlchemyExample)
            }
            disabled={testing}
            className='p-4 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {testing ? '⏳ Testing...' : '📋 Test Official Example'}
          </button>
        </div>

        {/* Test Addresses Info */}
        <div className='mb-6 p-4 bg-gray-50 rounded-lg'>
          <h3 className='font-semibold mb-2'>Test Configuration:</h3>
          <div className='text-sm space-y-1'>
            <div>
              <strong>User Address:</strong> {testAddresses.user}
            </div>
            <div>
              <strong>Recipient:</strong> {testAddresses.recipient}
            </div>
            <div>
              <strong>USDC Contract:</strong> {testAddresses.usdcContract}
            </div>
            <div>
              <strong>Network:</strong> Base Sepolia
            </div>
          </div>
        </div>

        {/* Results */}
        <div className='space-y-4'>
          {Object.entries(results).map(([testType, result]) => (
            <div key={testType}>{renderResult(testType, result)}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
