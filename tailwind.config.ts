import type { Config } from 'tailwindcss'

/**
 * Blue Star palette — official hexes only.
 *
 * Primary: Midnight #173150 · Hot Embers #f15a2b · Ironside #939598
 * Secondary: Denim #00608b · Dark Amber #F28A0F · Retro Teal #3F8A8C
 *
 * Do not invent ember shades (#c43d14, #f78a5c, …). Washes use opacity.
 * `teal-*` / `cyan-*` = Hot Embers. `sky-*` = Denim. `violet-*` = Ironside steel.
 */
const HOT_EMBERS = '#f15a2b'
const MIDNIGHT = '#173150'
const DENIM = '#00608b'
const DARK_AMBER = '#F28A0F'
const RETRO_TEAL = '#3F8A8C'

/** Same-hue paper washes (50–200) + one accent hex (300–600). Darker steps are Midnight. */
const ember = {
  50: '#fef4f0',
  100: '#fde8e0',
  200: '#f8c8b8',
  300: HOT_EMBERS,
  400: HOT_EMBERS,
  500: HOT_EMBERS,
  600: HOT_EMBERS,
  700: MIDNIGHT,
  800: MIDNIGHT,
  900: MIDNIGHT,
  950: '#0d1a28',
} as const

const denim = {
  50: '#e6f2f6',
  100: '#cce5ee',
  200: '#99cbdd',
  300: DENIM,
  400: DENIM,
  500: DENIM,
  600: DENIM,
  700: MIDNIGHT,
  800: MIDNIGHT,
  900: MIDNIGHT,
  950: '#0d1a28',
} as const

const darkAmber = {
  50: '#fef6eb',
  100: '#fde8c8',
  200: '#fad08a',
  300: DARK_AMBER,
  400: DARK_AMBER,
  500: DARK_AMBER,
  600: DARK_AMBER,
  700: MIDNIGHT,
  800: MIDNIGHT,
  900: MIDNIGHT,
  950: '#0d1a28',
} as const

const retroTeal = {
  50: '#eef6f6',
  100: '#d4e8e8',
  200: '#a8d1d2',
  300: RETRO_TEAL,
  400: RETRO_TEAL,
  500: RETRO_TEAL,
  600: RETRO_TEAL,
  700: MIDNIGHT,
  800: MIDNIGHT,
  900: MIDNIGHT,
  950: '#0d1a28',
} as const

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
        teal: ember,
        cyan: ember,
        sky: denim,
        violet: steel,
        purple: steel,
        emerald: forest,
        green: forest,
        ember: { DEFAULT: HOT_EMBERS, ...ember },
        denim: { DEFAULT: DENIM, ...denim },
        'dark-amber': { DEFAULT: DARK_AMBER, ...darkAmber },
        'retro-teal': { DEFAULT: RETRO_TEAL, ...retroTeal },
        ironside: {
          DEFAULT: '#939598',
          muted: '#7a7c7f',
        },
        /** @deprecated legacy classnames — maps to Hot Embers */
        'brand-sage': {
          DEFAULT: HOT_EMBERS,
          light: HOT_EMBERS,
          dark: MIDNIGHT,
        },
        'brand-mint': {
          DEFAULT: HOT_EMBERS,
          light: HOT_EMBERS,
        },
        'brand-cream': {
          DEFAULT: '#fef5ed',
          light: '#fef5ed',
          dark: '#fef5ed',
        },
        'brand-sage-light': ember[200],
        'brand-sage-dark': MIDNIGHT,
      },
      fontFamily: {
        quicksand: ['Quicksand', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
      },
    },
  },
}

export default config
