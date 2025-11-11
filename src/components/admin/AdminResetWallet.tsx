'use client'

import { useState, useEffect } from 'react'

interface AdminResetWalletProps {
  adminKey?: string
  initialWalletAddress?: string
}

interface ResetResponse {
  success?: boolean
  error?: string
  message?: string
  walletAddress?: string
}

export default function AdminResetWallet({
  adminKey,
  initialWalletAddress = '',
}: AdminResetWalletProps) {
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress)
  const [localAdminKey, setLocalAdminKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ResetResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setWalletAddress(initialWalletAddress)
  }, [initialWalletAddress])

  const handleReset = async () => {
    setError(null)
    setResult(null)

    const effectiveKey = (adminKey ?? localAdminKey).trim()
    const address = walletAddress.trim()
    if (!effectiveKey) {
      setError('Admin key is required.')
      return
    }

    if (!address) {
      setError('Please enter a wallet address.')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/reset-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': effectiveKey,
        },
        body: JSON.stringify({ walletAddress: address }),
      })

      const data = (await response.json()) as ResetResponse

      if (!response.ok) {
        setError(data.error || 'Failed to reset wallet data.')
        return
      }

      setResult(data)
      setWalletAddress('')
      setLocalAdminKey('')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('wallet-data-reset', {
            detail: { walletAddress: address },
          })
        )
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error encountered.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-brand-sage/30 bg-brand-sage-light/10 p-6 shadow-2xl">
      <h2 className="text-xl font-semibold text-brand-sage mb-4">
        Admin Reset Wallet Data
      </h2>
      {!adminKey && (
        <div className="mb-4 space-y-2">
          <p className="text-sm text-brand-sage/70">
            Enter your <code>ADMIN_API_KEY</code>. This value is not stored; it
            is only used for the current request.
          </p>
          <input
            type="password"
            value={localAdminKey}
            onChange={(e) => setLocalAdminKey(e.target.value)}
            placeholder="Admin API Key"
            className="w-full rounded-md border border-brand-sage/30 px-3 py-2 text-sm focus:border-brand-sage focus:outline-none focus:ring-2 focus:ring-brand-sage/30"
          />
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-brand-sage mb-2">
            Wallet Address
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-md border border-brand-sage/30 px-3 py-2 text-sm focus:border-brand-sage focus:outline-none focus:ring-2 focus:ring-brand-sage/30"
          />
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={
            isLoading ||
            !walletAddress.trim() ||
            !(adminKey?.trim() || localAdminKey.trim())
          }
          className="inline-flex items-center justify-center rounded-md bg-brand-sage px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-sage-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Resetting…' : 'Reset Wallet Data'}
        </button>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-md border border-brand-sage/30 bg-brand-sage-light/20 px-3 py-2 text-sm text-brand-sage">
            <p className="font-semibold">Wallet {result.walletAddress}</p>
            <p>{result.message || 'Reset complete.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

