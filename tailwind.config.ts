import type { Config } from 'tailwindcss'
import { withAccountKitUi, createColorSet } from '@account-kit/react/tailwind'

const config: Config = withAccountKitUi(
  {
    content: [
      './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
      './src/components/**/*.{js,ts,jsx,tsx,mdx}',
      './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: ['class', '[data-theme="dark"]'],
    theme: {
      extend: {
        colors: {
          // Brand colors - Theme-aware palette
          'brand-sage': {
            DEFAULT: '#697469', // Original sage color
            light: '#697469', // Light mode sage
            dark: '#4a5249', // Darker sage for gradients
          },
          'brand-mint': {
            DEFAULT: '#c9d9c3', // Original mint color
            light: '#697469', // Light mode uses sage for mint
          },
          'brand-cream': {
            DEFAULT: '#fef5ed', // Original cream color
            light: '#fef5ed', // Light mode background
            dark: '#fef5ed', // Original cream for dark mode
          },

          // Legacy color support (will be replaced gradually)
          'brand-sage-light': '#adc2a9',
          'brand-sage-dark': '#4a5249',
        },
        fontFamily: {
          quicksand: ['Quicksand', 'system-ui', '-apple-system', 'sans-serif'],
        },
      },
    },
  },
  {
    // Account Kit UI theme customizations
    colors: {
      // Button colors - our brand colors
      'btn-primary': createColorSet('#c9d9c3', '#c9d9c3'), // mint for both light/dark
      'btn-secondary': createColorSet('#adc2a9', '#adc2a9'), // sage-light for both
      'btn-auth': createColorSet('#c9d9c3', '#c9d9c3'), // mint for auth buttons

      // Text colors - cream for readability
      'fg-primary': createColorSet('#fef5ed', '#fef5ed'), // cream for primary text
      'fg-secondary': createColorSet('#fef5ed', '#fef5ed'), // cream for secondary text
      'fg-tertiary': createColorSet('#adc2a9', '#adc2a9'), // sage-light for tertiary
      'fg-invert': createColorSet('#697469', '#697469'), // sage for inverted text
      'fg-accent-brand': createColorSet('#c9d9c3', '#c9d9c3'), // mint as brand accent

      // Background colors - our sage theme
      'bg-surface-default': createColorSet('#697469', '#697469'), // sage background
      'bg-surface-subtle': createColorSet('#697469', '#697469'), // sage for subtle
      'bg-surface-inset': createColorSet('#697469', '#697469'), // sage for inputs

      // Border colors - mint for focus, sage-light for static
      active: createColorSet('#c9d9c3', '#c9d9c3'), // mint for focused borders
      static: createColorSet('#adc2a9', '#adc2a9'), // sage-light for static borders
    },
    borderRadius: 'md', // 16px border radius for modern look
  }
)

export default config
