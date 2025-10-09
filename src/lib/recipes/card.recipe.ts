import { defineRecipe } from '@chakra-ui/react'

export const cardRecipe = defineRecipe({
  className: 'brand-card',
  base: {
    display: 'flex',
    flexDirection: 'column',
    bg: 'bg.secondary',
    color: 'text.primary',
    rounded: 'xl',
    shadow: 'lg',
    border: '1px solid',
    borderColor: 'border.primary',
    overflow: 'hidden',
    transition: 'all {durations.normal} {easings.easeOut}',
  },
  variants: {
    variant: {
      elevated: {
        shadow: 'xl',
        _hover: {
          shadow: '2xl',
          transform: 'translateY(-4px)',
        },
      },
      outline: {
        shadow: 'none',
        borderWidth: '2px',
      },
      filled: {
        bg: 'bg.tertiary',
        shadow: 'none',
      },
      glass: {
        bg: { base: 'whiteAlpha.800', _dark: 'blackAlpha.800' },
        backdropFilter: 'blur(10px)',
        borderColor: 'border.primary',
      },
    },
    size: {
      sm: {
        p: 4,
        gap: 3,
      },
      md: {
        p: 6,
        gap: 4,
      },
      lg: {
        p: 8,
        gap: 6,
      },
    },
    interactive: {
      true: {
        cursor: 'pointer',
        _hover: {
          transform: 'translateY(-4px)',
          shadow: '2xl',
        },
        _active: {
          transform: 'translateY(-2px)',
          shadow: 'xl',
        },
      },
    },
  },
  defaultVariants: {
    variant: 'elevated',
    size: 'md',
  },
})
