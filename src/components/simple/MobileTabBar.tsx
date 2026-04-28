'use client'

/**
 * MobileTabBar — animated bottom tab bar for phones (< md).
 *
 * Adapted from Mauricio Bucardo's CodePen (https://codepen.io/Jexter/pen/jOwRmOZ).
 * Active item pops up above the bar with a colored circle; a wavy SVG
 * clip-path "notch" follows via translate3d. Icon stroke animates on switch.
 *
 * Uses `env(safe-area-inset-bottom)` so it sits above Safari's URL bar.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useSimpleModeStore, type MobileGuidedTab } from '@/stores/simple-mode-store'

const TABS: { id: MobileGuidedTab; label: string; color: string }[] = [
  { id: 'jobs', label: 'Jobs', color: '#14b8a6' },
  { id: 'job', label: 'Job', color: '#38bdf8' },
  { id: 'card', label: 'Card', color: '#8b5cf6' },
]

/**
 * Inline SVG icons so we can animate stroke-dashoffset on the <path> elements.
 * Lucide components don't expose individual paths for this effect.
 */
function JobsIcon() {
  return (
    <svg className='tab-icon' viewBox='0 0 24 24'>
      <circle cx='11' cy='11' r='7' />
      <path d='M16.5 16.5L21 21' />
    </svg>
  )
}

function JobIcon() {
  return (
    <svg className='tab-icon' viewBox='0 0 24 24'>
      <rect x='2' y='7' width='20' height='14' rx='2' />
      <path d='M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2' />
      <path d='M12 12v.01' />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg className='tab-icon' viewBox='0 0 24 24'>
      <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
      <circle cx='12' cy='7' r='4' />
    </svg>
  )
}

const ICONS: Record<MobileGuidedTab, () => JSX.Element> = {
  jobs: JobsIcon,
  job: JobIcon,
  card: CardIcon,
}

export default function MobileTabBar() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const mobileTab = useSimpleModeStore((s) => s.mobileTab)
  const setMobileTab = useSimpleModeStore((s) => s.setMobileTab)
  const hasJob = useSimpleModeStore((s) => !!s.selectedJobSnapshot)

  const menuRef = useRef<HTMLDivElement>(null)
  const borderRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activeIndex = TABS.findIndex((t) => t.id === mobileTab)

  const positionBorder = useCallback(() => {
    const menu = menuRef.current
    const border = borderRef.current
    const activeEl = itemRefs.current[activeIndex]
    if (!menu || !border || !activeEl) return
    const rect = activeEl.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const left = rect.left - menuRect.left - (border.offsetWidth - rect.width) / 2
    border.style.transform = `translate3d(${left}px, 0, 0)`
  }, [activeIndex])

  useLayoutEffect(() => {
    positionBorder()
  }, [positionBorder])

  useEffect(() => {
    const onResize = () => {
      if (menuRef.current) {
        menuRef.current.style.setProperty('--timeOut', 'none')
      }
      positionBorder()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [positionBorder])

  const handleClick = useCallback(
    (tab: MobileGuidedTab) => {
      if (tab === 'job' && !hasJob) return
      if (menuRef.current) menuRef.current.style.removeProperty('--timeOut')
      setMobileTab(tab)
    },
    [setMobileTab, hasJob],
  )

  return (
    <>
      {/* Hidden SVG defining the wavy clip-path */}
      <svg className='absolute size-0' aria-hidden>
        <clipPath
          id='tab-notch'
          clipPathUnits='objectBoundingBox'
          transform='scale(0.0049285362247413 0.021978021978022)'
        >
          <path d='M6.7,45.5c5.7,0.1,14.1-0.4,23.3-4c5.7-2.3,9.9-5,18.1-10.5c10.7-7.1,11.8-9.2,20.6-14.3c5-2.9,9.2-5.2,15.2-7c7.1-2.1,13.3-2.3,17.6-2.1c4.2-0.2,10.5,0.1,17.6,2.1c6.1,1.8,10.2,4.1,15.2,7c8.8,5,9.9,7.1,20.6,14.3c8.3,5.5,12.4,8.2,18.1,10.5c9.2,3.6,17.6,4.2,23.3,4H6.7z' />
        </clipPath>
      </svg>

      <div
        ref={menuRef}
        className={cn(
          'tab-bar',
          isDark ? 'tab-bar--dark' : 'tab-bar--light',
        )}
        role='tablist'
        aria-label='Apply mode navigation'
      >
        {TABS.map((tab, i) => {
          const Icon = ICONS[tab.id]
          const active = tab.id === mobileTab
          const disabled = tab.id === 'job' && !hasJob
          return (
            <button
              key={tab.id}
              ref={(el) => { itemRefs.current[i] = el }}
              role='tab'
              aria-selected={active}
              aria-disabled={disabled}
              className={cn('tab-item', active && 'tab-item--active', disabled && 'tab-item--disabled')}
              style={{ '--bgColorItem': tab.color } as React.CSSProperties}
              onClick={() => handleClick(tab.id)}
            >
              <Icon />
              <span className='tab-label'>{tab.label}</span>
            </button>
          )
        })}
        <div
          ref={borderRef}
          className='tab-border'
        />
      </div>
    </>
  )
}
