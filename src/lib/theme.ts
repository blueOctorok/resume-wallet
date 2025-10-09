import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineTokens,
} from '@chakra-ui/react'
import { buttonRecipe, cardRecipe, badgeRecipe } from './recipes'

// Your brand colors from the original design
const brandColors = {
  sage: '#697469',
  sageLight: '#adc2a9',
  mint: '#d3e4cd',
  cream: '#fef5ed',
}

// Define design tokens using the recommended defineTokens helper
const tokens = defineTokens({
  colors: {
    // Brand color tokens - core brand identity
    brand: {
      sage: {
        value: brandColors.sage,
        description: 'Primary brand color - sage green',
      },
      sageLight: {
        value: brandColors.sageLight,
        description: 'Light sage for accents and hover states',
      },
      mint: {
        value: brandColors.mint,
        description: 'Mint green for borders and interactive elements',
      },
      cream: {
        value: brandColors.cream,
        description: 'Warm cream for backgrounds',
      },
    },
  },

  fonts: {
    body: {
      value: 'Quicksand, system-ui, -apple-system, sans-serif',
      description: 'Primary font for body text',
    },
    heading: {
      value: 'Quicksand, system-ui, -apple-system, sans-serif',
      description: 'Primary font for headings',
    },
  },

  fontWeights: {
    extralight: { value: '200' },
    light: { value: '300' },
    normal: { value: '400' },
    medium: { value: '500' },
    semibold: { value: '600' },
    bold: { value: '700' },
  },

  radii: {
    sm: { value: '0.375rem' },
    md: { value: '0.5rem' },
    lg: { value: '0.75rem' },
    xl: { value: '1rem' },
    '2xl': { value: '1.5rem' },
    full: { value: '9999px' },
  },

  spacing: {
    0: { value: '0px' },
    1: { value: '0.25rem' },
    2: { value: '0.5rem' },
    3: { value: '0.75rem' },
    4: { value: '1rem' },
    5: { value: '1.25rem' },
    6: { value: '1.5rem' },
    8: { value: '2rem' },
    10: { value: '2.5rem' },
    12: { value: '3rem' },
    16: { value: '4rem' },
    20: { value: '5rem' },
    24: { value: '6rem' },
  },

  shadows: {
    sm: { value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
    md: { value: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    lg: { value: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' },
    xl: { value: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  },

  durations: {
    fast: { value: '150ms' },
    normal: { value: '250ms' },
    slow: { value: '350ms' },
  },

  easings: {
    easeIn: { value: 'cubic-bezier(0.4, 0, 1, 1)' },
    easeOut: { value: 'cubic-bezier(0, 0, 0.2, 1)' },
    easeInOut: { value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  },
})

// Define the theme configuration
const config = defineConfig({
  // CSS variables will be applied to the root element
  cssVarsRoot: ':where(:root, :host)',

  // Use 'chakra' as the prefix for CSS variables
  cssVarsPrefix: 'chakra',

  // Apply global styles
  globalCss: {
    'html, body': {
      margin: 0,
      padding: 0,
      fontFamily: 'Quicksand, system-ui, -apple-system, sans-serif',
    },
  },

  // Enable CSS reset
  preflight: true,

  // Define the theme
  theme: {
    // Add our defined tokens
    tokens,

    // Custom breakpoints (keeping Chakra defaults)
    breakpoints: {
      base: '0rem',
      sm: '30rem', // ~480px
      md: '48rem', // ~768px
      lg: '62rem', // ~992px
      xl: '80rem', // ~1280px
      '2xl': '96rem', // ~1536px
    },

    // Define semantic tokens (theme-aware colors)
    semanticTokens: {
      colors: {
        // Background colors - swap based on theme
        bg: {
          DEFAULT: {
            value: {
              base: '{colors.brand.cream}',
              _dark: '{colors.brand.sage}',
            },
          },
          primary: {
            value: {
              base: '{colors.brand.cream}',
              _dark: '{colors.brand.sage}',
            },
          },
          secondary: {
            value: { base: 'white', _dark: '{colors.brand.sage}' },
          },
          tertiary: {
            value: { base: 'gray.50', _dark: 'gray.800' },
          },
          muted: {
            value: {
              base: '{colors.brand.mint}',
              _dark: '{colors.brand.sageLight}',
            },
          },
        },

        // Text colors - swap based on theme
        text: {
          DEFAULT: {
            value: {
              base: '{colors.brand.sage}',
              _dark: '{colors.brand.cream}',
            },
          },
          primary: {
            value: {
              base: '{colors.brand.sage}',
              _dark: '{colors.brand.cream}',
            },
          },
          secondary: {
            value: {
              base: '{colors.brand.sageLight}',
              _dark: '{colors.brand.cream}',
            },
          },
          muted: {
            value: { base: 'gray.600', _dark: 'gray.400' },
          },
        },

        // Border colors
        border: {
          DEFAULT: {
            value: {
              base: '{colors.brand.mint}',
              _dark: '{colors.brand.mint}',
            },
          },
          primary: {
            value: {
              base: '{colors.brand.mint}',
              _dark: '{colors.brand.mint}',
            },
          },
          secondary: {
            value: { base: 'gray.200', _dark: 'gray.700' },
          },
        },

        // Interactive colors
        interactive: {
          DEFAULT: {
            value: {
              base: '{colors.brand.mint}',
              _dark: '{colors.brand.mint}',
            },
          },
          primary: {
            value: {
              base: '{colors.brand.mint}',
              _dark: '{colors.brand.mint}',
            },
          },
          hover: {
            value: {
              base: '{colors.brand.sageLight}',
              _dark: '{colors.brand.sageLight}',
            },
          },
        },
      },
    },

    // Define text styles
    textStyles: {
      'brand.heading': {
        value: {
          fontFamily: 'Quicksand',
          fontWeight: 'extralight',
          bgGradient: 'to-r',
          gradientFrom: 'brand.sage',
          gradientTo: 'brand.sageLight',
          bgClip: 'text',
        },
      },
      'brand.body': {
        value: {
          fontFamily: 'Quicksand',
          fontWeight: 'normal',
        },
      },
    },

    // Define layer styles (reusable component styles)
    layerStyles: {
      'brand.card': {
        value: {
          bg: 'bg.secondary',
          color: 'text.primary',
          rounded: 'xl',
          shadow: 'lg',
          border: '1px solid',
          borderColor: 'border.primary',
          p: 6,
        },
      },
      'brand.nav': {
        value: {
          bg: { base: 'whiteAlpha.800', _dark: 'blackAlpha.800' },
          backdropFilter: 'blur(10px)',
          rounded: '2xl',
          shadow: 'xl',
          border: '1px solid',
          borderColor: 'border.primary',
        },
      },
      'brand.button': {
        value: {
          bg: 'interactive.primary',
          color: 'text.primary',
          px: 4,
          py: 2,
          rounded: 'lg',
          fontWeight: 'medium',
          transition: 'all token(durations.fast) token(easings.easeOut)',
          _hover: {
            bg: 'interactive.hover',
            transform: 'translateY(-2px)',
            shadow: 'md',
          },
          _active: {
            transform: 'translateY(0)',
            shadow: 'sm',
          },
        },
      },
    },

    // Component recipes (multi-variant styles)
    recipes: {
      button: buttonRecipe,
      card: cardRecipe,
      badge: badgeRecipe,
    },
  },
})

// Create the system
export const system = createSystem(defaultConfig, config)

// Export for use in Provider
export default system
