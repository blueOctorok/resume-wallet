'use client'

import { useCallback, useEffect, useState } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Storm-Themed Animated Background with tsParticles
 *
 * Creates a stormy atmosphere with:
 * - Drifting cloud SVG shapes (actual cloud silhouettes)
 * - Occasional lightning bolt flashes (CSS overlay)
 * - Rain-like particles falling
 *
 * Fits the StormChain brand — aggressive, dynamic, powerful
 */

// Storm cloud SVG - overlapping ellipses for organic billowy shape
const cloudSvg = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80">
      <!-- Dark base layer - flat bottom -->
      <ellipse cx="80" cy="58" rx="75" ry="22" fill="${color}"/>
      <!-- Billowy top bumps -->
      <ellipse cx="35" cy="42" rx="28" ry="24" fill="${color}"/>
      <ellipse cx="70" cy="32" rx="32" ry="28" fill="${color}"/>
      <ellipse cx="110" cy="38" rx="30" ry="26" fill="${color}"/>
      <ellipse cx="135" cy="48" rx="22" ry="20" fill="${color}"/>
      <!-- Extra irregular bumps -->
      <ellipse cx="52" cy="25" rx="18" ry="16" fill="${color}"/>
      <ellipse cx="95" cy="22" rx="20" ry="18" fill="${color}"/>
    </svg>
  `)}`

// Rain drop SVG - thin subtle streak
const rainDropSvg = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 8">
      <line x1="0.5" y1="0" x2="0.5" y2="8" stroke="${color}" stroke-width="0.8" stroke-linecap="round"/>
    </svg>
  `)}`

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

  // Cloud colors per theme - dark heavy storm clouds
  const cloudColor = isDark ? '#1f2937' : '#475569'

  // Rain color - subtle blue-gray tint
  const rainColor = isDark ? '#a0aec0' : '#64748b'

  return (
    <>
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

      {/* Cloud layer - actual cloud SVG shapes drifting */}
      <Particles
        id='storm-clouds'
        init={particlesInit}
        options={{
          fullScreen: {
            enable: true,
            zIndex: -2,
          },
          background: {
            color: { value: '' },
          },
          fpsLimit: 30,
          particles: {
            number: {
              value: 8,
              density: {
                enable: true,
                value_area: 1000,
              },
            },
            shape: {
              type: 'image',
              image: {
                src: cloudSvg(cloudColor),
                width: 160,
                height: 80,
              },
            },
            opacity: {
              value: 0.6,
              random: true,
              anim: {
                enable: true,
                speed: 0.1,
                opacity_min: 0.3,
                sync: false,
              },
            },
            size: {
              value: 200,
              random: true,
              anim: {
                enable: false,
              },
            },
            move: {
              enable: true,
              speed: 0.4,
              direction: 'left',
              random: true,
              straight: false,
              out_mode: 'out',
              bounce: false,
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
