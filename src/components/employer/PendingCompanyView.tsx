'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import ProjectedCareerCard from '@/components/career-card/ProjectedCareerCard'
import PoolTeaserStrip from '@/components/career-card/PoolTeaserStrip'
import type { ProjectedCareerCard as CardData } from '@/types/career-card'

/**
 * Unapproved company. They keep the one public card that brought them here
 * (the public projection — not the employer talent view) plus the same
 * aggregate teaser. Talent search stays hidden until admin approves.
 */
export default function PendingCompanyView({
  companyName,
  originShareToken,
}: {
  companyName: string
  originShareToken: string | null
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [card, setCard] = useState<CardData | null>(null)

  useEffect(() => {
    if (!originShareToken) return
    let cancelled = false
    fetch(`/api/career-card?token=${encodeURIComponent(originShareToken)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.card) setCard(json.card as CardData)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [originShareToken])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <HubSectionPanel isDark={isDark} accent="amber">
        <BlockCard
          variant="embed"
          paper
          icon={Clock}
          title="Company pending approval"
          description={`${companyName} can view the card that brought you here. Talent search unlocks after Provven approves your company.`}
        >
          <p className={`text-center text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            You do not need to wait on an email to look at that card. Full search stays off until approval.
          </p>
        </BlockCard>
      </HubSectionPanel>

      {originShareToken && (
        <PoolTeaserStrip shareToken={originShareToken} showAccessCta={false} />
      )}

      {card && (
        <ProjectedCareerCard data={card} mode="public" />
      )}
    </div>
  )
}
