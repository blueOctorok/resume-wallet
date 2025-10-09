import { defineRecipe } from '@chakra-ui/react'

export const buttonRecipe = defineRecipe({
  className: 'brand-button',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'body',
    fontWeight: 'medium',
    cursor: 'pointer',
    transition: 'all {durations.fast} {easings.easeOut}',
    userSelect: 'none',
    outline: 'none',
    _disabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
      pointerEvents: 'none',
    },
    _focusVisible: {
      ring: '2px',
      ringColor: 'interactive.primary',
      ringOffset: '2px',
    },
  },
  variants: {
    variant: {
      solid: {
        bg: 'interactive.primary',
        color: 'text.primary',
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
      outline: {
        bg: 'transparent',
        color: 'text.primary',
        border: '2px solid',
        borderColor: 'border.primary',
        _hover: {
          bg: 'bg.muted',
          transform: 'translateY(-2px)',
          shadow: 'md',
        },
        _active: {
          transform: 'translateY(0)',
          shadow: 'sm',
        },
      },
      ghost: {
        bg: 'transparent',
        color: 'text.primary',
        _hover: {
          bg: 'bg.muted',
        },
        _active: {
          bg: 'bg.tertiary',
        },
      },
      link: {
        bg: 'transparent',
        color: 'interactive.primary',
        textDecoration: 'underline',
        _hover: {
          color: 'interactive.hover',
        },
      },
    },
    size: {
      sm: {
        px: 3,
        py: 1.5,
        fontSize: 'sm',
        rounded: 'md',
        gap: 1.5,
      },
      md: {
        px: 4,
        py: 2,
        fontSize: 'md',
        rounded: 'lg',
        gap: 2,
      },
      lg: {
        px: 6,
        py: 3,
        fontSize: 'lg',
        rounded: 'xl',
        gap: 2.5,
      },
    },
    fullWidth: {
      true: {
        w: 'full',
      },
    },
  },
  defaultVariants: {
    variant: 'solid',
    size: 'md',
  },
})
