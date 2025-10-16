'use client'

import { useCallback } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Animated Background with tsParticles
 *
 * Creates cream-colored floating bubble particles that rise upward
 * - Cream bubbles against sage-to-dark-sage gradient background
 * - Slow, subtle rising movement
 * - Interactive on hover and click
 */

export default function AnimatedBackground() {
  const { theme } = useTheme()

  const particlesInit = useCallback(async (engine: any) => {
    console.log('🎨 Initializing tsParticles v2')
    await loadSlim(engine)
  }, [])

  // Theme-aware particle colors
  const particleColors =
    theme === 'light'
      ? ['#697469', '#697469', '#adc2a9', '#697469'] // Sage colors for light mode
      : ['#fef5ed', '#fef5ed', '#c9d9c3', '#fef5ed'] // Cream colors for dark mode

  return (
    <Particles
      id='tsparticles'
      init={particlesInit}
      options={{
        fullScreen: {
          enable: true,
          zIndex: 0,
        },
        background: {
          color: {
            value: '',
          },
        },
        fpsLimit: 60,
        particles: {
          number: {
            value: 40,
            density: {
              enable: true,
              value_area: 800,
            },
          },
          shape: {
            type: 'circle',
          },
          color: {
            value: particleColors,
          },
          opacity: {
            value: 0.4,
            random: true,
            anim: {
              enable: true,
              speed: 0.3,
              opacity_min: 0.15,
              sync: false,
            },
          },
          size: {
            value: 4,
            random: true,
            anim: {
              enable: true,
              speed: 1,
              size_min: 1.5,
              sync: false,
            },
          },
          move: {
            enable: true,
            speed: 1,
            direction: 'top',
            random: true,
            straight: false,
            out_mode: 'out',
            bounce: false,
          },
        },
        interactivity: {
          detect_on: 'canvas',
          events: {
            onhover: {
              enable: true,
              mode: 'bubble',
            },
            onclick: {
              enable: true,
              mode: 'repulse',
            },
            resize: true,
          },
          modes: {
            bubble: {
              distance: 150,
              size: 8,
              duration: 2,
              opacity: 0.6,
              speed: 3,
            },
            repulse: {
              distance: 200,
              duration: 0.4,
            },
          },
        },
        retina_detect: true,
      }}
    />
  )
}
