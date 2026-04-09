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
  const isSepia = theme === 'sepia'
  const isPaper = theme === 'paper'
  const isBusiness = theme === 'business'

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

  /* Less pure-white wash than before — let body + vault grain read as icy depth */
  const lightAtmosphere = [
    'linear-gradient(122deg, rgba(224,242,242,0.35) 0%, rgba(255,255,255,0.2) 24%, transparent 48%)',
    'linear-gradient(to bottom, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 38%, transparent 58%)',
    'radial-gradient(ellipse 115% 62% at 50% -12%, rgba(13,148,136,0.11), transparent 56%)',
    'radial-gradient(ellipse 48% 38% at 94% 6%, rgba(91,33,182,0.08), transparent 54%)',
    'radial-gradient(ellipse 58% 44% at 6% 90%, rgba(30,58,90,0.06), transparent 52%)',
    'radial-gradient(ellipse 90% 52% at 50% 108%, rgba(15,23,42,0.07), transparent 54%)',
  ].join(', ')

  /* Sepia: warm haze only — no teal/violet */
  const sepiaAtmosphere = [
    'linear-gradient(125deg, rgba(255,248,236,0.5) 0%, rgba(245,235,218,0.22) 32%, transparent 52%)',
    'linear-gradient(to bottom, rgba(255,255,255,0.12) 0%, transparent 45%)',
    'radial-gradient(ellipse 120% 65% at 50% 0%, rgba(220,200,172,0.08), transparent 55%)',
    'radial-gradient(ellipse 90% 55% at 50% 100%, rgba(100,88,72,0.04), transparent 50%)',
  ].join(', ')

  /* Newsprint: cool grey air — no chroma */
  const newsprintAtmosphere = [
    'linear-gradient(125deg, rgba(255,255,255,0.42) 0%, rgba(244,244,246,0.18) 34%, transparent 54%)',
    'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, transparent 48%)',
    'radial-gradient(ellipse 118% 62% at 50% 0%, rgba(228,228,231,0.2), transparent 56%)',
    'radial-gradient(ellipse 88% 52% at 50% 100%, rgba(82,82,91,0.03), transparent 52%)',
  ].join(', ')

  /* Business classic: flat off-white canvas, barely-there cool tint */
  const corporateAtmosphere = [
    'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(243,244,246,0.35) 45%, transparent 62%)',
    'radial-gradient(ellipse 120% 70% at 50% 0%, rgba(219,234,254,0.14), transparent 58%)',
    'linear-gradient(178deg, #f3f4f6 0%, #f9fafb 55%, #ffffff 100%)',
  ].join(', ')

  const particleOptions = useMemo((): ISourceOptions => {
    const bubbleColor = isDark
      ? '#5c6d82'
      : isSepia
        ? '#c4b5a0'
        : isPaper
          ? '#a1a1aa'
          : isBusiness
            ? '#cbd5e1'
            : '#5f7a8c'
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

    const count = reduceMotion ? 14 : isDark ? 48 : isSepia || isPaper || isBusiness ? 14 : 44
    const speed = reduceMotion ? 0.18 : isDark ? 0.55 : isSepia || isPaper || isBusiness ? 0.28 : 0.65
    const opacityBase = isDark ? 0.32 : isSepia || isPaper || isBusiness ? 0.05 : 0.3

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
  }, [isBusiness, isDark, isPaper, isSepia, reduceMotion])

  return (
    <>
      <div
        className='fixed inset-0 pointer-events-none z-[-4]'
        style={{
          background: isDark
            ? stormAtmosphere
            : isSepia
              ? sepiaAtmosphere
              : isPaper
                ? newsprintAtmosphere
                : isBusiness
                  ? corporateAtmosphere
                  : lightAtmosphere,
        }}
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
