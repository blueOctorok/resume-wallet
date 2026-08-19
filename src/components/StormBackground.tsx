'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import type { ISourceOptions } from 'tsparticles-engine'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import VaultLightFrostTexture from '@/components/ui/VaultLightFrostTexture'
import VaultDarkCanvasTexture from '@/components/ui/VaultDarkCanvasTexture'

/**
 * App canvas — vault-aligned glossy texture on the full viewport (light + dark).
 * Particles: **bubbles only** (calm upward drift); dark no longer uses cloud image, rain, or lightning.
 *
 * Stack (back → front): atmosphere → vault canvas texture → bubbles (z-[-1]).
 */

export default function StormBackground() {
  const { theme } = useTheme()
  const [reduceMotion, setReduceMotion] = useState(false)

  const particlesInit = useCallback(async (engine: { addShape?: unknown }) => {
    await loadSlim(engine as never)
  }, [])

  const isDark = isDarkTheme(theme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  /* Flat ink / paper — no radial bloom. */
  const stormAtmosphere = 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 26%, transparent 68%, rgba(0,0,0,0.48) 100%)'

  const lightAtmosphere = [
    'linear-gradient(122deg, rgba(247,243,234,0.4) 0%, rgba(255,255,255,0.2) 24%, transparent 48%)',
    'linear-gradient(to bottom, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 38%, transparent 58%)',
  ].join(', ')

  const particleOptions = useMemo((): ISourceOptions => {
    const bubbleColor = isDark ? '#5c6d82' : '#8a7a5f'
    const base: ISourceOptions = {
      fullScreen: { enable: true, zIndex: -1 },
      background: { color: { value: '' } },
      fpsLimit: 60,
      interactivity: {
        events: {
          onhover: { enable: false },
          onclick: { enable: false },
          resize: true,
        },
      },
      retina_detect: true,
    }

    const count = reduceMotion ? 14 : isDark ? 48 : 44
    const speed = reduceMotion ? 0.18 : isDark ? 0.55 : 0.65
    const opacityBase = isDark ? 0.32 : 0.3

    return {
      ...base,
      particles: {
        number: {
          value: count,
          density: { enable: true, value_area: 1150 },
        },
        shape: { type: 'circle' },
        color: { value: bubbleColor },
        opacity: {
          value: opacityBase,
          random: true,
          anim: {
            enable: !reduceMotion,
            speed: 0.28,
            minimumValue: 0.08,
            sync: false,
          },
        },
        size: {
          value: isDark ? 3.2 : 4,
          random: { enable: true, minimumValue: isDark ? 1.2 : 1.5 },
          anim: { enable: false },
        },
        move: {
          enable: true,
          speed,
          direction: 'top',
          random: true,
          straight: false,
          out_mode: 'out',
          bounce: false,
        },
      },
    }
  }, [isDark, reduceMotion])

  return (
    <>
      <div
        className='fixed inset-0 pointer-events-none z-[-4]'
        style={{ background: isDark ? stormAtmosphere : lightAtmosphere }}
        aria-hidden
      />

      <div
        className='pointer-events-none fixed inset-0 z-[-3] overflow-hidden'
        aria-hidden
      >
        {isDark ? (
          <VaultDarkCanvasTexture />
        ) : (
          <VaultLightFrostTexture variant='canvas' />
        )}
      </div>

      <Particles
        key={`bubbles-${theme}-${reduceMotion ? 'rm' : 'full'}`}
        id='storm-canvas-bubbles'
        init={particlesInit}
        options={particleOptions}
      />
    </>
  )
}
