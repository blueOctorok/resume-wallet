// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom brand colors - Green Sage Palette
        brand: {
          sage: '#99a799', // Deep sage green - primary text
          sageLight: '#adc2a9', // Light sage - secondary text
          mint: '#d3e4cd', // Soft mint green - accent color
          cream: '#fef5ed', // Warm cream - background/light
        },
      },
      fontFamily: {
        sans: ['Quicksand', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  },
  plugins: [],
}

export default config
