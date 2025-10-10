'use client'

import { useCallback } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'

/**
 * Animated Background with tsParticles
 *
 * Creates floating bubble particles that drift like stars
 * - Brand colors: sage-light, mint, cream
 * - Slow, subtle movement
 * - Interactive on hover and click
 */

export default function AnimatedBackground() {
  const particlesInit = useCallback(async (engine: any) => {
    console.log('🎨 Initializing tsParticles v2')
    await loadSlim(engine)
  }, [])

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
            value: 30,
            density: {
              enable: true,
              value_area: 800,
            },
          },
          shape: {
            type: 'circle',
          },
          color: {
            value: ['#adc2a9', '#c9d9c3', '#fef5ed'], // sage-light, mint, cream
          },
          opacity: {
            value: 0.5,
            random: true,
            anim: {
              enable: true,
              speed: 0.5,
              opacity_min: 0.2,
              sync: false,
            },
          },
          size: {
            value: 5,
            random: true,
            anim: {
              enable: true,
              speed: 1.5,
              size_min: 2,
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
