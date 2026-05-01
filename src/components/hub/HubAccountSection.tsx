'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import STORMBalance from '@/components/STORMBalance'
import ReferralBanner from '@/components/hub/ReferralBanner'

export interface HubAccountSectionProps {
  walletAddress: string
  onReadWhitepaper: () => void
}

/**
 * STORM balance, USDC on-ramp, referral link, and whitepaper — one foldable card
 * so the hub stays about the career card first.
 */
export default function HubAccountSection({ walletAddress, onReadWhitepaper }: HubAccountSectionProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [open, setOpen] = useState(false)

  return (
    <HubSectionPanel isDark={isDark} accent='indigo'>
      <BlockCard
        variant='embed'
        icon={Wallet}
        title='Account & STORM'
        description='Token balance, add funds, referrals, and docs.'
        headerActions={
          <Button
            type='button'
            variant='secondary'
            size='sm'
            className='shrink-0 gap-1'
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? (
              <>
                <ChevronUp className='h-3.5 w-3.5' />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className='h-3.5 w-3.5' />
                Show
              </>
            )}
          </Button>
        }
      >
        {open ? (
          <div className='space-y-6'>
            <STORMBalance
              walletAddress={walletAddress}
              showBuyUsdc
              onReadWhitepaper={onReadWhitepaper}
            />
            <ReferralBanner />
          </div>
        ) : (
          <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-slate-600')}>
            Wallet, STORM, USDC, and your referral link — expand when you need them.
          </p>
        )}
      </BlockCard>
    </HubSectionPanel>
  )
}
