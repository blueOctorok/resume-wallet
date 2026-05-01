import type { Config } from 'tailwindcss'
import { withAccountKitUi, createColorSet } from '@account-kit/react/tailwind'

const config: Config = withAccountKitUi(
  {
    content: [
      './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
      './src/components/**/*.{js,ts,jsx,tsx,mdx}',
      './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: ['class', '[data-theme="dark"]', '[data-theme="ink"]'],
    theme: {
      extend: {
        colors: {
          // Brand colors - Theme-aware palette
          /** @deprecated Use `teal-*` / `cyan-*` — kept for rare legacy classnames; maps to vault teal */
          'brand-sage': {
            DEFAULT: '#0f766e',
            light: '#115e59',
            dark: '#134e4a',
          },
          'brand-mint': {
            DEFAULT: '#0d9488',
            light: '#14b8a6',
          },
          'brand-cream': {
            DEFAULT: '#fef5ed', // Original cream color
            light: '#fef5ed', // Light mode background
            dark: '#fef5ed', // Original cream for dark mode
          },

          // Legacy color support (will be replaced gradually)
          'brand-sage-light': '#99f6e4',
          'brand-sage-dark': '#134e4a',
        },
        fontFamily: {
          quicksand: ['Quicksand', 'system-ui', '-apple-system', 'sans-serif'],
        },
      },
    },
  },
  {
    /**
     * Account Kit (Alchemy) auth UI — must meet WCAG contrast on white / slate surfaces.
     * Deprecated sage/mint/cream preset put cream `fg-primary` on light cards and washed-out
     * primary buttons. This aligns with Storm teal (`--storm-accent`) + slate neutrals.
     *
     * `.akui-btn-primary` uses `color: var(--akui-fg-invert)` — light mode needs white text on teal;
     * dark mode uses a brighter teal fill + dark `fg-invert` (same pattern as Account Kit defaults).
     */
    colors: {
      active: createColorSet('#0d9488', '#2dd4bf'),
      static: createColorSet('#cbd5e1', '#64748b'),
      critical: createColorSet('#f87171', '#dc2626'),

      'btn-primary': createColorSet('#0d9488', '#2dd4bf'),
      'btn-secondary': createColorSet('#f1f5f9', '#334155'),
      'btn-auth': createColorSet('#ffffff', 'rgba(30, 41, 59, 0.92)'),

      'fg-primary': createColorSet('#0f172a', '#f1f5f9'),
      'fg-secondary': createColorSet('#475569', '#cbd5e1'),
      'fg-tertiary': createColorSet('#64748b', '#94a3b8'),
      'fg-invert': createColorSet('#ffffff', '#0f172a'),
      'fg-disabled': createColorSet('#94a3b8', '#475569'),
      'fg-accent-brand': createColorSet('#0d9488', '#5eead4'),
      'fg-critical': createColorSet('#b91c1c', '#f87171'),
      'fg-success': createColorSet('#16a34a', '#86efac'),

      'bg-surface-default': createColorSet('#ffffff', '#0f172a'),
      'bg-surface-subtle': createColorSet('#f8fafc', '#1e293b'),
      'bg-surface-inset': createColorSet('#f1f5f9', '#334155'),
      'bg-surface-critical': createColorSet('#fef2f2', '#450a0a'),
      'bg-surface-error': createColorSet('#dc2626', '#f87171'),
      'bg-surface-success': createColorSet('#16a34a', '#86efac'),
      'bg-surface-warning': createColorSet('#ea580c', '#fdba74'),
    },
    borderRadius: 'md',
  }
)

export default config
