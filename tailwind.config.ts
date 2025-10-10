import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors - Dark theme palette
        'brand-sage': '#697469',
        'brand-sage-light': '#adc2a9',
        'brand-mint': '#c9d9c3',
        'brand-cream': '#fef5ed',
      },
      fontFamily: {
        quicksand: ['Quicksand', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
}

export default config
