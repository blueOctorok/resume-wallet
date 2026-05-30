'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import ReferralBanner from '@/components/hub/ReferralBanner'

/**
 * Referral link in a foldable card so the hub stays career-card-first.
 *
 * The personal STORM/USDC wallet balance was removed at the T1.12 cutover
 * (auth is Supabase-only, no signer). Referrals stay — they don't depend on a
 * wallet.
 */
export default function HubAccountSection() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [open, setOpen] = useState(false)

  return (
    <HubSectionPanel isDark={isDark} accent='indigo'>
      <BlockCard
        variant='embed'
        icon={Gift}
        title='Refer a friend'
        description='Share your invite link.'
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
          <ReferralBanner />
        ) : (
          <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-slate-600')}>
            Your referral link — expand when you need it.
          </p>
        )}
      </BlockCard>
    </HubSectionPanel>
  )
}
