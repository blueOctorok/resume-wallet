'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import type { ISourceOptions } from 'tsparticles-engine'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Theme-split atmosphere:
 * - **Dark:** storm — cloud texture, rain particles, rare lightning (brand “power” read).
 * - **Light:** calm bubbles + loader-aligned teal/violet atmosphere (specular gloss, single accent hue).
 *
 * Layering (dark, back → front): body gradient → atmosphere → cloud → rain → lightning.
 * Light: layered atmosphere (studio-style gradients, no animation) → optional film grain → bubbles.
 */

export default function StormBackground() {
  const { theme } = useTheme()
  const [lightning, setLightning] = useState(false)

  const particlesInit = useCallback(async (engine: { addShape?: unknown }) => {
    await loadSlim(engine as never)
  }, [])

  const isDark = theme === 'dark'

  useEffect(() => {
    if (!isDark) {
      setLightning(false)
      return
    }
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>

    const schedule = () => {
      if (cancelled) return
      const nextFlash = 25000 + Math.random() * 25000
      timeoutId = setTimeout(() => {
        if (cancelled) return
        setLightning(true)
        setTimeout(() => setLightning(false), 150)
        schedule()
      }, nextFlash)
    }

    schedule()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [isDark])

  const rainColor = '#94a3b8'
  /** Light bubbles: cool slate with a hint of teal (same family as --storm-accent, not sage) */
  const bubbleColor = '#7d8fa3'

  /* Layered like body + LoadingScreen: teal/violet blooms, deep edge vignette */
  const stormAtmosphere = `
      radial-gradient(ellipse min(90vw, 38rem) min(90vw, 38rem) at 50% 12%, rgba(45,212,191,0.07), transparent 58%),
      radial-gradient(ellipse 100% 55% at 50% -38%, rgba(45,212,191,0.06), transparent 58%),
      radial-gradient(ellipse 72% 48% at 100% 100%, rgba(139,92,246,0.065), transparent 55%),
      linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 26%, transparent 68%, rgba(0,0,0,0.48) 100%)
    `

  /* Light: loader-aligned blooms (teal-600 + violet), stronger specular gloss, no cyan wedge */
  const lightAtmosphere = [
    'linear-gradient(122deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.14) 26%, transparent 50%)',
    'linear-gradient(to bottom, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.05) 34%, transparent 56%)',
    'radial-gradient(ellipse 115% 62% at 50% -12%, rgba(13,148,136,0.088), transparent 58%)',
    'radial-gradient(ellipse 48% 38% at 94% 6%, rgba(124,58,237,0.065), transparent 55%)',
    'radial-gradient(ellipse 58% 44% at 6% 90%, rgba(15,23,42,0.04), transparent 52%)',
    'radial-gradient(ellipse 90% 52% at 50% 108%, rgba(15,23,42,0.06), transparent 55%)',
  ].join(', ')

  const particleOptions = useMemo((): ISourceOptions => {
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

    if (isDark) {
      return {
        ...base,
        particles: {
          number: {
            value: 58,
            density: { enable: true, value_area: 1100 },
          },
          shape: { type: 'circle' },
          color: { value: rainColor },
          opacity: {
            value: 0.52,
            random: true,
            anim: { enable: false },
          },
          size: {
            value: 2,
            random: true,
            anim: { enable: false },
          },
          move: {
            enable: true,
            speed: 14,
            direction: 'bottom',
            random: false,
            straight: true,
            out_mode: 'out',
            bounce: false,
            angle: { value: 85, offset: 0 },
          },
        },
      }
    }

    return {
      ...base,
      particles: {
        number: {
          value: 44,
          density: { enable: true, value_area: 1150 },
        },
        shape: { type: 'circle' },
        color: { value: bubbleColor },
        opacity: {
          value: 0.26,
          random: true,
          anim: {
            enable: true,
            speed: 0.28,
            minimumValue: 0.1,
            sync: false,
          },
        },
        size: {
          value: 4,
          random: { enable: true, minimumValue: 1.5 },
          anim: { enable: false },
        },
        move: {
          enable: true,
          speed: 0.65,
          direction: 'top',
          random: true,
          straight: false,
          out_mode: 'out',
          bounce: false,
        },
      },
    }
  }, [isDark])

  return (
    <>
      <div
        className='fixed inset-0 pointer-events-none z-[-4]'
        style={{ background: isDark ? stormAtmosphere : lightAtmosphere }}
        aria-hidden
      />

      {/* Fine grain + depth on light only; dark keeps storm texture from cloud/rain */}
      {!isDark && <div className='storm-light-film-grain' aria-hidden />}

      {isDark && (
        <>
          <div
            className='fixed inset-0 pointer-events-none bg-cover bg-center'
            style={{
              zIndex: -3,
              backgroundImage: 'url(/dark_cloud.png)',
              opacity: 0.36,
              mixBlendMode: 'screen',
              filter: 'contrast(1.08) saturate(1.06)',
            }}
            aria-hidden
          />

          <div
            className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-100 ${
              lightning ? 'opacity-[0.22]' : 'opacity-0'
            }`}
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, #e2e8ff 0%, transparent 58%)',
            }}
            aria-hidden
          />
        </>
      )}

      <Particles
        key={isDark ? 'storm-rain' : 'light-bubbles'}
        id={isDark ? 'storm-rain' : 'light-bubbles'}
        init={particlesInit}
        options={particleOptions}
      />
    </>
  )
}
