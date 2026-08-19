import type { Config } from 'tailwindcss'

/**
 * BLUE STAR PALETTE PREVIEW (2026-08-18) — boss review.
 *
 * Midnight Blue #173150 · Hot Embers #f15a2b · Ironside #939598
 * Teal/cyan classes still mean "accent" and now render the ember scale.
 * Violet/purple stay Ironside-steel (Stormi). Emerald stays forest (success).
 */
const gold = {
  50: '#fef4f0',
  100: '#fde4d8',
  200: '#fbc4ae',
  300: '#f89a70',
  400: '#f15a2b',
  500: '#d94a1e',
  600: '#c43d14',
  700: '#8f2f12',
  800: '#6b240e',
  900: '#4a190a',
  950: '#2a0e06',
} as const

/**
 * Success / "done". Raw Tailwind emerald was the one scale that never got
 * heritage-ified, and it showed in LIGHT mode: `emerald-100` (#d1fae5) is a
 * cool mint (hue ~155°) sitting on warm cream (#fef5ed) beside champagne gold
 * (hue ~35°) — two pastels at the same lightness with opposite temperature,
 * which reads muddy/medical. Dark mode never had the problem because a 15%
 * tint over ink navy neutralizes almost all of the hue.
 *
 * Fix: bottle/forest green instead of mint. Navy + gold + deep green is a
 * classic heraldic pairing (banknotes, wax seals). The light steps (50–200)
 * are deliberately LOW-CHROMA sage so a filled chip reads as a soft neutral
 * against cream rather than a block of mint; 600–800 are sober enough to
 * carry text, and 300–400 stay luminous enough to read on ink navy.
 */
const forest = {
  50: '#f2f7f4',
  100: '#e2ece6',
  200: '#c4d8cc',
  300: '#94b8a4',
  400: '#6b9a82',
  500: '#4a7c62',
  600: '#3a6650',
  700: '#2d5140',
  800: '#234033',
  900: '#1a3027',
  950: '#0f1c17',
} as const

const steel = {
  50: '#f4f5f6',
  100: '#e8e9ea',
  200: '#d4d5d6',
  300: '#b8babc',
  400: '#939598',
  500: '#7a7c7f',
  600: '#626466',
  700: '#4d4f51',
  800: '#3a3c3e',
  900: '#2a2c2d',
  950: '#18191a',
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
        emerald: forest,
        green: forest,

        // Brand colors - Theme-aware palette
        /** @deprecated legacy classnames — now maps to Hot Embers */
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
        /** Headlines — same family as body (`--font-montserrat`). `font-display` stays so call sites don't change. */
        display: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
      },
    },
  },
}

export default config
