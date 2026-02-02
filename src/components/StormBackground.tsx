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
 */

export default function StormBackground() {
  const { theme } = useTheme()
  const [lightning, setLightning] = useState(false)

  const particlesInit = useCallback(async (engine: any) => {
    console.log('⛈️ Initializing StormChain particles')
    await loadSlim(engine)
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

  // Rain color - subtle blue-gray tint
  const rainColor = isDark ? '#a0aec0' : '#64748b'

  return (
    <>
      {/* Static dark cloud — dark: screen (black bg gone). Light: invert + multiply so cloud is dark and visible */}
      <div
        className='fixed inset-0 pointer-events-none bg-cover bg-center'
        style={{
          zIndex: -3,
          backgroundImage: 'url(/dark_cloud.png)',
          opacity: isDark ? 0.25 : 0.22,
          mixBlendMode: isDark ? 'screen' : 'multiply',
          filter: isDark ? undefined : 'invert(1)',
        }}
      />

      {/* Lightning flash overlay - subtle glow from sky */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-100 ${
          lightning ? 'opacity-15' : 'opacity-0'
        }`}
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 50% 0%, #e0e7ff 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 50% 0%, #1e293b 0%, transparent 60%)',
        }}
      />

      {/* Rain layer - very subtle, gentle rain */}
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
              value: 50, // Fewer drops
              density: {
                enable: true,
                value_area: 1200,
              },
            },
            shape: {
              type: 'circle', // Simple circles, not SVG
            },
            color: {
              value: rainColor,
            },
            opacity: {
              value: 0.3, // Very subtle
              random: true,
              anim: {
                enable: false,
              },
            },
            size: {
              value: 2.3,
              random: true,
              anim: {
                enable: false,
              },
            },
            move: {
              enable: true,
              speed: 12,
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
