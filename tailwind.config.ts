import type { Config } from 'tailwindcss'

const config: Config = {
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
        /** Landing-page display serif (Fraunces via next/font) — `font-display` */
        display: ['var(--font-fraunces)', 'Georgia', 'ui-serif', 'serif'],
      },
    },
  },
}

export default config
