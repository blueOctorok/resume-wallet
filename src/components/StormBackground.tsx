'use client'

import { useCallback, useEffect, useState } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Storm-Themed Animated Background with tsParticles
 *
 * Creates a stormy atmosphere with:
 * - Static dark cloud image (dark_cloud.png) — screen blend in dark, inverted + multiply in light
 * - Occasional lightning bolt flashes (CSS overlay)
 * - Rain-like particles falling
 *
 * Fits the StormChain brand — aggressive, dynamic, powerful
 *
 * Layering (back → front): body gradient → atmosphere (vignette + gloss) → cloud → rain → lightning.
 */

export default function StormBackground() {
  const { theme } = useTheme()
  const [lightning, setLightning] = useState(false)

  /** tsparticles passes its Engine instance; slim bundle has no stable exported type here */
  const particlesInit = useCallback(async (engine: { addShape?: unknown }) => {
    await loadSlim(engine as never)
  }, [])

  // Random lightning flashes - infrequent for accessibility
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const triggerLightning = () => {
      // Random interval between 25-50 seconds (much less frequent for accessibility)
      const nextFlash = 25000 + Math.random() * 25000

      timeoutId = setTimeout(() => {
        setLightning(true)
        // Single brief flash (no rapid double-flash to avoid seizure risk)
        setTimeout(() => setLightning(false), 150)
        triggerLightning()
      }, nextFlash)
    }

    triggerLightning()

    // Cleanup timeout on unmount
    return () => clearTimeout(timeoutId)
  }, [])

  // Theme-aware colors
  const isDark = theme === 'dark'

  // Rain — slightly higher contrast so it reads against the sharper base (still not loud)
  const rainColor = isDark ? '#94a3b8' : '#475569'

  const atmosphereBg = isDark
    ? `
      radial-gradient(ellipse 100% 55% at 50% -38%, rgba(45,212,191,0.08), transparent 58%),
      radial-gradient(ellipse 72% 48% at 100% 100%, rgba(139,92,246,0.05), transparent 55%),
      linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, transparent 24%, transparent 70%, rgba(0,0,0,0.52) 100%)
    `
    : `
      linear-gradient(to bottom, rgba(255,255,255,0.72) 0%, transparent 40%),
      radial-gradient(ellipse 95% 52% at 50% -24%, rgba(20,184,166,0.11), transparent 54%),
      linear-gradient(to bottom, transparent 62%, rgba(15,23,42,0.11) 100%)
    `

  return (
    <>
      {/* Vignette + brand gloss — tighter, more “studio” than a flat wash */}
      <div
        className='fixed inset-0 pointer-events-none z-[-4]'
        style={{ background: atmosphereBg }}
        aria-hidden
      />

      {/* Static dark cloud — dark: screen (black bg gone). Light: invert + multiply so cloud is dark and visible */}
      <div
        className='fixed inset-0 pointer-events-none bg-cover bg-center'
        style={{
          zIndex: -3,
          backgroundImage: 'url(/dark_cloud.png)',
          opacity: isDark ? 0.36 : 0.3,
          mixBlendMode: isDark ? 'screen' : 'multiply',
          filter: isDark ? 'contrast(1.08) saturate(1.06)' : 'invert(1) contrast(1.08)',
        }}
        aria-hidden
      />

      {/* Lightning flash overlay — single brief pulse (accessibility) */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-100 ${
          lightning ? 'opacity-[0.22]' : 'opacity-0'
        }`}
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 50% 0%, #e2e8ff 0%, transparent 58%)'
            : 'radial-gradient(ellipse at 50% 0%, #0f172a 0%, transparent 58%)',
        }}
        aria-hidden
      />

      {/* Rain */}
      <Particles
        id='storm-rain'
        init={particlesInit}
        options={{
          fullScreen: {
            enable: true,
            zIndex: -1,
          },
          background: {
            color: { value: '' },
          },
          fpsLimit: 60,
          particles: {
            number: {
              value: 58,
              density: {
                enable: true,
                value_area: 1100,
              },
            },
            shape: {
              type: 'circle', // Simple circles, not SVG
            },
            color: {
              value: rainColor,
            },
            opacity: {
              value: 0.52,
              random: true,
              anim: {
                enable: false,
              },
            },
            size: {
              value: 2,
              random: true,
              anim: {
                enable: false,
              },
            },
            move: {
              enable: true,
              speed: 14,
              direction: 'bottom',
              random: false,
              straight: true,
              out_mode: 'out',
              bounce: false,
              angle: {
                value: 85,
                offset: 0,
              },
            },
          },
          interactivity: {
            events: {
              onhover: { enable: false },
              onclick: { enable: false },
              resize: true,
            },
          },
          retina_detect: true,
        }}
      />
    </>
  )
}
