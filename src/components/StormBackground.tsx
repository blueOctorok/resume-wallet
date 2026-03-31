'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import type { ISourceOptions } from 'tsparticles-engine'
import { useTheme } from '@/contexts/ThemeContext'
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

  const isDark = theme === 'dark'

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const stormAtmosphere = `
      radial-gradient(ellipse min(90vw, 38rem) min(90vw, 38rem) at 50% 12%, rgba(45,212,191,0.07), transparent 58%),
      radial-gradient(ellipse 100% 55% at 50% -38%, rgba(45,212,191,0.06), transparent 58%),
      radial-gradient(ellipse 72% 48% at 100% 100%, rgba(139,92,246,0.065), transparent 55%),
      linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 26%, transparent 68%, rgba(0,0,0,0.48) 100%)
    `

  const lightAtmosphere = [
    'linear-gradient(122deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.14) 26%, transparent 50%)',
    'linear-gradient(to bottom, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.05) 34%, transparent 56%)',
    'radial-gradient(ellipse 115% 62% at 50% -12%, rgba(13,148,136,0.088), transparent 58%)',
    'radial-gradient(ellipse 48% 38% at 94% 6%, rgba(124,58,237,0.065), transparent 55%)',
    'radial-gradient(ellipse 58% 44% at 6% 90%, rgba(15,23,42,0.04), transparent 52%)',
    'radial-gradient(ellipse 90% 52% at 50% 108%, rgba(15,23,42,0.06), transparent 55%)',
  ].join(', ')

  const particleOptions = useMemo((): ISourceOptions => {
    const bubbleColor = isDark ? '#5c6d82' : '#7d8fa3'
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

    const count = reduceMotion ? 22 : isDark ? 48 : 44
    const speed = reduceMotion ? 0.22 : isDark ? 0.55 : 0.65
    const opacityBase = isDark ? 0.32 : 0.26

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
        {isDark ? <VaultDarkCanvasTexture /> : <VaultLightFrostTexture variant='canvas' />}
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
