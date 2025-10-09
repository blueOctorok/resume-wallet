'use client'

import { chakra } from '@chakra-ui/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

// Base Navigation Container
export const NavContainer = chakra('nav', {
  base: {
    position: 'fixed',
    top: { base: 3, sm: 6 },
    left: '50%',
    transform: 'translateX(-50%)',
    maxW: { base: 'sm', sm: '2xl', lg: '5xl' },
    w: { base: 'calc(100% - 1.5rem)', sm: 'calc(100% - 2rem)' },
    zIndex: 50,
  },
})

// Navigation Bar with backdrop blur
export const NavBar = chakra('div', {
  base: {
    bg: 'whiteAlpha.800',
    backdropFilter: 'blur(10px)',
    rounded: '2xl',
    shadow: 'xl',
    border: '1px solid',
    borderColor: 'border.primary',
    _dark: {
      bg: 'blackAlpha.800',
      borderColor: 'border.primary',
    },
  },
})

// Navigation Content
export const NavContent = chakra('div', {
  base: {
    px: { base: 3, sm: 4, lg: 6 },
    py: { base: 3, sm: 4 },
  },
})

// Navigation Header with flex layout
export const NavHeader = chakra('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    w: 'full',
  },
})

// Logo Container
export const LogoContainer = chakra('div', {
  base: {
    flexShrink: 0,
  },
})

// Logo Text with gradient
export const LogoText = chakra('h1', {
  base: {
    fontSize: { base: 'xl', sm: '2xl', lg: '4xl' },
    fontWeight: 'extralight',
    bgGradient: 'linear(to-r, brand.sage, brand.sageLight)',
    bgClip: 'text',
  },
})

// Desktop Navigation
export const DesktopNav = chakra('div', {
  base: {
    hideBelow: 'md',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
})

// Mobile Menu Button
export const MobileMenuButton = chakra('button', {
  base: {
    hideFrom: 'md',
    p: 2,
    rounded: 'lg',
    transition: 'colors',
    bg: 'brand.mint',
    border: '1px solid',
    borderColor: 'brand.sageLight',
    _hover: {
      bg: 'brand.sageLight',
    },
    _dark: {
      bg: 'brand.sage',
      borderColor: 'brand.sageLight',
      _hover: {
        bg: 'brand.sageLight',
      },
    },
  },
})

// Mobile Menu Icon
export const MobileMenuIcon = chakra('div', {
  base: {
    w: 5,
    h: 5,
    display: 'flex',
    flexDir: 'column',
    justifyContent: 'center',
    gap: 1,
  },
})

// Mobile Menu Line
export const MobileMenuLine = chakra('div', {
  base: {
    w: 'full',
    h: '2px',
    bg: 'brand.sage',
    transition: 'all 0.2s',
    _dark: {
      bg: 'brand.sageLight',
    },
  },
  variants: {
    state: {
      open: {
        transform: 'rotate(45deg) translateY(6px)',
      },
      closed: {},
    },
  },
})

// Mobile Menu Line (middle)
export const MobileMenuLineMiddle = chakra('div', {
  base: {
    w: 'full',
    h: '2px',
    bg: 'brand.sage',
    transition: 'opacity 0.2s',
    _dark: {
      bg: 'brand.sageLight',
    },
  },
  variants: {
    state: {
      open: {
        opacity: 0,
      },
      closed: {},
    },
  },
})

// Mobile Menu Line (bottom)
export const MobileMenuLineBottom = chakra('div', {
  base: {
    w: 'full',
    h: '2px',
    bg: 'brand.sage',
    transition: 'all 0.2s',
    _dark: {
      bg: 'brand.sageLight',
    },
  },
  variants: {
    state: {
      open: {
        transform: 'rotate(-45deg) translateY(-6px)',
      },
      closed: {},
    },
  },
})

// Mobile Menu Dropdown
export const MobileMenuDropdown = chakra('div', {
  base: {
    hideFrom: 'md',
    mt: 3,
    pt: 3,
    borderTop: '1px solid',
    borderColor: 'border.primary',
  },
})

// Mobile Menu Content
export const MobileMenuContent = chakra('div', {
  base: {
    display: 'flex',
    flexDir: 'column',
    gap: 3,
    py: 2,
  },
})

// Mobile Menu Item
export const MobileMenuItem = chakra('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// Theme Toggle Button
export const ThemeButton = chakra('button', {
  base: {
    p: 2,
    rounded: 'md',
    transition: 'colors',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variants: {
    active: {
      true: {
        bg: 'brand.mint',
        color: 'brand.sage',
      },
      false: {
        color: 'brand.sageLight',
        _hover: {
          bg: 'brand.cream',
        },
        _dark: {
          _hover: {
            bg: 'brand.sage',
          },
        },
      },
    },
  },
})
