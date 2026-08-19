'use client'

/**
 * Construct-mode feature CTAs under the career card.
 * Uses per-block accent colors from the registry so each feature feels distinct
 * (not a stack of identical teal primary buttons).
 */

import {
  Car,
  ClipboardList,
  FileWarning,
  IdCard,
  LayoutGrid,
  Plus,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getBlockColor,
  getBlockDefinition,
  type DriverFeatureCta,
} from '@/lib/block-registry'

const FEATURE_ICONS: Record<string, LucideIcon> = {
  'driver-dot-application': ClipboardList,
  'driver-mvr': Car,
  'driver-psp': FileWarning,
  'driver-cdl-credentials': IdCard,
  'driver-screening-consent': ShieldCheck,
}

export interface CareerCardFeatureActionsProps {
  isDark: boolean
  featureCtas: DriverFeatureCta[]
  onAddFeature?: (blockType: string) => void
  onBrowseFeatures?: () => void
}

export default function CareerCardFeatureActions({
  isDark,
  featureCtas,
  onAddFeature,
  onBrowseFeatures,
}: CareerCardFeatureActionsProps) {
  // Defensive: never crash the hub if a caller omits the array
  const ctas = featureCtas ?? []
  if (!onAddFeature && !onBrowseFeatures) return null
  if (ctas.length === 0 && !onBrowseFeatures) return null

  return (
    <div className='space-y-3 pt-1'>
      {onAddFeature && ctas.length > 0 && (
        <div className='space-y-2.5'>
          <div className='flex items-baseline justify-between gap-3 px-0.5'>
            <p
              className={cn(
                'text-[11px] font-bold uppercase tracking-[0.14em]',
                isDark ? 'text-teal-400/90' : 'text-teal-700',
              )}
            >
              Strengthen your card
            </p>
            <p className={cn('text-[11px] tabular-nums', isDark ? 'text-gray-500' : 'text-slate-500')}>
              {ctas.length} available
            </p>
          </div>

          <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
            {ctas.map((cta) => {
              const def = getBlockDefinition(cta.id)
              const colors = getBlockColor(cta.id)
              const Icon = FEATURE_ICONS[cta.id] ?? Plus
              const blurb = def?.description ?? 'Add this feature to your career card.'

              return (
                <button
                  key={cta.id}
                  type='button'
                  onClick={() => onAddFeature(cta.id)}
                  className={cn(
                    'group relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-3.5 text-left',
                    'transition-[transform,box-shadow,border-color,background-color] duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2',
                    isDark
                      ? 'border-gray-700/90 bg-gray-900/55 hover:bg-gray-900/90 focus-visible:ring-offset-gray-950'
                      : 'border-slate-200/90 bg-white/90 hover:bg-white focus-visible:ring-offset-white',
                    isDark ? colors.borderHover.dark : colors.borderHover.light,
                    'hover:-translate-y-0.5',
                  )}
                >
                  {/* Accent strip — mirrors BlockCard vault chrome */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-y-0 left-0 w-1 rounded-l-xl opacity-80 transition-opacity group-hover:opacity-100',
                      colors.badgeColor,
                    )}
                  />

                  <div
                    className={cn(
                      'ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                      isDark ? colors.iconBg.dark : colors.iconBg.light,
                      isDark ? 'ring-white/10' : 'ring-black/5',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[1.125rem] w-[1.125rem]',
                        isDark ? colors.iconText.dark : colors.iconText.light,
                      )}
                      aria-hidden
                    />
                  </div>

                  <div className='min-w-0 flex-1 pt-0.5'>
                    <p
                      className={cn(
                        'text-sm font-semibold leading-snug',
                        isDark ? 'text-white' : 'text-slate-900',
                      )}
                    >
                      {cta.label}
                    </p>
                    <p
                      className={cn(
                        'mt-0.5 line-clamp-2 text-[11px] leading-relaxed',
                        isDark ? 'text-gray-400' : 'text-slate-600',
                      )}
                    >
                      {blurb}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                      isDark
                        ? 'border-gray-600 text-gray-400 group-hover:border-teal-400/50 group-hover:bg-teal-500/15 group-hover:text-teal-300'
                        : 'border-slate-200 text-slate-400 group-hover:border-teal-500/40 group-hover:bg-teal-50 group-hover:text-teal-700',
                    )}
                    aria-hidden
                  >
                    <Plus className='h-3.5 w-3.5' />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {onBrowseFeatures && (
        <button
          type='button'
          onClick={onBrowseFeatures}
          className={cn(
            'group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-dashed px-4 py-3.5',
            'text-sm font-semibold transition-[border-color,background-color,color,box-shadow] duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50',
            isDark
              ? 'border-teal-500/35 bg-gradient-to-r from-teal-500/[0.07] via-transparent to-teal-500/[0.07] text-teal-200/90 hover:border-teal-400/55 hover:from-teal-500/15 hover:to-teal-500/15 hover:text-teal-100'
              : 'border-teal-500/40 bg-gradient-to-r from-teal-50/80 via-white to-teal-50/80 text-teal-800 hover:border-teal-600/50 hover:from-teal-50 hover:to-teal-50 hover:text-teal-900',
          )}
        >
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-105',
              isDark
                ? 'bg-teal-500/15 text-teal-300 ring-teal-400/25'
                : 'bg-teal-100 text-teal-700 ring-teal-200',
            )}
          >
            <LayoutGrid className='h-4 w-4' aria-hidden />
          </span>
          Add features to career card
          <Plus
            className={cn(
              'h-4 w-4 opacity-60 transition-opacity group-hover:opacity-100',
              isDark ? 'text-teal-300' : 'text-teal-600',
            )}
            aria-hidden
          />
        </button>
      )}
    </div>
  )
}
