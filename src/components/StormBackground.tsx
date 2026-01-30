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

// Storm cloud SVGs - loaded from public folder
const CLOUD_SVGS = [
  { src: '/storm_cloud.svg', width: 128, height: 89 },   // 1280:894 aspect
  { src: '/storm_cloud_2.svg', width: 115, height: 100 }, // 1280:1109 aspect
]

// Wide thin cloud for top of screen only
const TOP_CLOUD_SVG = { src: '/storm_cloud_3.svg', width: 200, height: 100 } // 1280:640 = 2:1 aspect

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
              image: CLOUD_SVGS, // Randomly picks from both cloud shapes
            },
            opacity: {
              value: isDark ? 0.4 : 0.25, // Lower opacity since SVG is black
              random: true,
              anim: {
                enable: true,
                speed: 0.1,
                opacity_min: isDark ? 0.2 : 0.1,
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

      {/* Top cloud banner - large wide cloud drifting under header */}
      <div className='fixed top-12 left-0 right-0 h-[25vh] pointer-events-none overflow-hidden' style={{ zIndex: -2 }}>
        <Particles
          id='storm-clouds-top'
          init={particlesInit}
          options={{
            fullScreen: {
              enable: false, // Contained in parent div
            },
            background: {
              color: { value: '' },
            },
            fpsLimit: 30,
            particles: {
              number: {
                value: 2, // Just 1-2 big clouds scrolling
              },
              shape: {
                type: 'image',
                image: TOP_CLOUD_SVG,
              },
              opacity: {
                value: isDark ? 0.6 : 0.35,
                random: false,
                anim: {
                  enable: false,
                },
              },
              size: {
                value: 800, // Very large - spans most of the width
                random: false,
                anim: {
                  enable: false,
                },
              },
              move: {
                enable: true,
                speed: 0.5, // Slow steady drift
                direction: 'left',
                random: false,
                straight: true,
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
      </div>

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
