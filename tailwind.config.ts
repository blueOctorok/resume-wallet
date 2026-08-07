import type { Config } from 'tailwindcss'

/**
 * HERITAGE BRAND PALETTE (2026-08-07) — read before touching colors.
 *
 * Provven's brand is ink-navy + cream + champagne GOLD ("the seal").
 * Teal and violet are permanently retired. Rather than rewrite ~2,400
 * `teal-*` / `violet-*` class usages across 200+ files, the scales are
 * REMAPPED here at the theme level:
 *
 *   teal-*, cyan-*        → gold scale (brand accent, verified, CTAs)
 *   violet-*, purple-*    → steel scale (muted navy-blue; Stormi/AI surfaces)
 *
 * So `bg-teal-600` renders champagne gold everywhere, and any future
 * `teal-*` class CANNOT reintroduce teal — it renders gold by definition.
 * When writing NEW code, still write `teal-*`/`violet-*` classes (they are
 * the accent/AI tokens); a future codemod may rename them to gold/steel.
 */
const gold = {
  50: '#faf6ee',
  100: '#f4ecd9',
  200: '#e8d9b5',
  300: '#d9c08c',
  400: '#cda868',
  500: '#b8904d',
  600: '#9c7740',
  700: '#7d5e33',
  800: '#654b29',
  900: '#533d22',
  950: '#2f2212',
} as const

const steel = {
  50: '#f4f6fa',
  100: '#e9edf4',
  200: '#d0d9e7',
  300: '#aabbd2',
  400: '#7f97b8',
  500: '#5f7a9e',
  600: '#4c6485',
  700: '#3f526c',
  800: '#364559',
  900: '#2d394a',
  950: '#1d2530',
} as const

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Heritage remap — see file header
        teal: gold,
        cyan: gold,
        violet: steel,
        purple: steel,

        // Brand colors - Theme-aware palette
        /** @deprecated legacy classnames — now maps to heritage gold */
        'brand-sage': {
          DEFAULT: gold[700],
          light: gold[600],
          dark: gold[800],
        },
        'brand-mint': {
          DEFAULT: gold[600],
          light: gold[500],
        },
        'brand-cream': {
          DEFAULT: '#fef5ed', // Original cream color
          light: '#fef5ed', // Light mode background
          dark: '#fef5ed', // Original cream for dark mode
        },

        // Legacy color support (will be replaced gradually)
        'brand-sage-light': gold[200],
        'brand-sage-dark': gold[800],
      },
      fontFamily: {
        quicksand: ['Quicksand', 'system-ui', '-apple-system', 'sans-serif'],
        /** Landing-page display serif (Fraunces via next/font) — `font-display` */
        display: ['var(--font-fraunces)', 'Georgia', 'ui-serif', 'serif'],
      },
    },
  },
}

export default config
