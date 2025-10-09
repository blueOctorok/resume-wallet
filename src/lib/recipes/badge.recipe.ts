import { defineRecipe } from '@chakra-ui/react'

export const badgeRecipe = defineRecipe({
  className: 'brand-badge',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'body',
    fontWeight: 'semibold',
    textTransform: 'uppercase',
    letterSpacing: 'wider',
    whiteSpace: 'nowrap',
  },
  variants: {
    variant: {
      solid: {
        bg: 'interactive.primary',
        color: 'text.primary',
      },
      subtle: {
        bg: 'bg.muted',
        color: 'text.primary',
      },
      outline: {
        bg: 'transparent',
        color: 'text.primary',
        border: '1px solid',
        borderColor: 'border.primary',
      },
    },
    size: {
      sm: {
        px: 2,
        py: 0.5,
        fontSize: 'xs',
        rounded: 'md',
        gap: 1,
      },
      md: {
        px: 2.5,
        py: 1,
        fontSize: 'sm',
        rounded: 'lg',
        gap: 1.5,
      },
      lg: {
        px: 3,
        py: 1.5,
        fontSize: 'md',
        rounded: 'lg',
        gap: 2,
      },
    },
  },
  defaultVariants: {
    variant: 'subtle',
    size: 'md',
  },
})
