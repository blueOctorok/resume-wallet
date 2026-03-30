'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import type { ISourceOptions } from 'tsparticles-engine'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Theme-split atmosphere:
 * - **Dark:** storm — cloud texture, rain particles, rare lightning (brand “power” read).
 * - **Light:** calm bubbles — soft rising dots, no cloud/rain/lightning (less moody; matches fintech light UI).
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
  /** Light bubbles: slightly cooler mist — reads finer than flat gray dots */
  const bubbleColor = '#8b9cb0'

  const stormAtmosphere = `
      radial-gradient(ellipse 100% 55% at 50% -38%, rgba(45,212,191,0.08), transparent 58%),
      radial-gradient(ellipse 72% 48% at 100% 100%, rgba(139,92,246,0.05), transparent 55%),
      linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, transparent 24%, transparent 70%, rgba(0,0,0,0.52) 100%)
    `

  /* Light: layered “studio” depth — softbox + restrained brand blooms + corner anchors. No animation = not bootcamp. */
  const lightAtmosphere = [
    /* Specular sheen (upper-left) — satin, kept faint */
    'linear-gradient(128deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.08) 28%, transparent 52%)',
    /* Top softbox wash */
    'linear-gradient(to bottom, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.06) 36%, transparent 58%)',
    /* Brand auroras — low chroma, large radius */
    'radial-gradient(ellipse 115% 62% at 50% -12%, rgba(45,212,191,0.09), transparent 58%)',
    'radial-gradient(ellipse 48% 38% at 94% 6%, rgba(139,92,246,0.055), transparent 55%)',
    'radial-gradient(ellipse 52% 42% at 4% 88%, rgba(14,165,233,0.045), transparent 50%)',
    /* Bottom anchor — grounds the canvas so it isn’t one flat slab */
    'radial-gradient(ellipse 90% 52% at 50% 108%, rgba(15,23,42,0.055), transparent 55%)',
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
