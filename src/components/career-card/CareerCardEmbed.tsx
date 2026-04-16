import Link from 'next/link'
import Card from '@/components/ui/Card'
import type { ProjectedCareerCard } from '@/types/career-card'

type ThemeMode = 'light' | 'dark'

/**
 * Compact career card for iframe embeds (`/card/[token]/embed`).
 * Parent page sets `dark` class / `data-theme` so Tailwind `dark:` variants apply without ThemeProvider.
 */
export default function CareerCardEmbed({
  token,
  card,
  compact,
  theme,
}: {
  token: string
  card: ProjectedCareerCard
  compact: boolean
  theme: ThemeMode
}) {
  const fullHref = `/card/${token}`
  const score = card.careerCardScore
  const verified = card.onChainCredentialCount

  return (
    <div
      className={
        theme === 'dark'
          ? 'min-h-0 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-3 sm:p-4'
          : 'min-h-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-3 sm:p-4'
      }
    >
      <Card variant="elevated" className={compact ? 'max-w-sm mx-auto' : 'max-w-md mx-auto'}>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-3">
            {card.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- embed: external avatar URL
              <img
                src={card.avatarUrl}
                alt=""
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border border-teal-500/40 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-200 shrink-0 border border-teal-500/30">
                {card.name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {card.name}
              </h1>
              {card.occupation ? (
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{card.occupation}</p>
              ) : null}
            </div>
            <div
              className="shrink-0 flex flex-col items-center justify-center rounded-full border-2 border-teal-500/60 dark:border-teal-400/50 w-12 h-12 sm:w-14 sm:h-14"
              title="Career card score"
            >
              <span className="text-sm font-extrabold text-teal-700 dark:text-teal-300">{score}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 w-full">
              Verified on-chain
            </span>
            <span className="inline-flex items-center rounded-md bg-teal-500/15 dark:bg-teal-400/10 text-teal-800 dark:text-teal-200 px-2 py-0.5 text-xs font-semibold border border-teal-500/25 dark:border-teal-400/20">
              {verified} credential{verified === 1 ? '' : 's'}
            </span>
            {card.employerConfirmedEmploymentCount > 0 ? (
              <span className="inline-flex items-center rounded-md bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 text-xs font-semibold border border-indigo-500/20">
                {card.employerConfirmedEmploymentCount} employer confirmation
                {card.employerConfirmedEmploymentCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>

          {!compact && card.sections.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                On your card
              </p>
              <div className="flex flex-wrap gap-1.5">
                {card.sections.slice(0, 8).map((s) => (
                  <span
                    key={s.blockType}
                    className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="pt-1 flex flex-col gap-2">
            <Link
              href={fullHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2.5 shadow-sm transition-colors"
            >
              View full Career Card on Storm
            </Link>
            <p className="text-center text-[10px] text-gray-500 dark:text-gray-400">
              Blockchain-verified identity · stormchain.ai
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
