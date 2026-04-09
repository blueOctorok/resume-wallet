'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSTORMBalanceSepolia, getSTORMBalanceMainnet } from '@/lib/alchemy-token-api'

/**
 * STORM ERC-20 balance for the smart account — same rule as STORMBalance compact:
 * show Base Sepolia if non-zero, otherwise Base mainnet.
 */
export function useStormTokenBalance(
  walletAddress: string | null | undefined,
  refreshMs = 60_000,
) {
  const [display, setDisplay] = useState('0.00')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setDisplay('0.00')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [sep, main] = await Promise.all([
        getSTORMBalanceSepolia(walletAddress),
        getSTORMBalanceMainnet(walletAddress),
      ])
      const sepStr = sep.success ? sep.balanceFormatted : '0.00'
      const mainStr = main.success ? main.balanceFormatted : '0.00'
      setDisplay(sepStr !== '0.00' ? sepStr : mainStr)
    } catch {
      setDisplay('0.00')
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!walletAddress || refreshMs <= 0) return
    const id = setInterval(() => void refresh(), refreshMs)
    return () => clearInterval(id)
  }, [walletAddress, refreshMs, refresh])

  return { display, loading, refresh }
}
