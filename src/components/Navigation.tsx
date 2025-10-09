'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import {
  NavContainer,
  NavBar,
  NavContent,
  NavHeader,
  LogoContainer,
  LogoText,
  DesktopNav,
  MobileMenuButton,
  MobileMenuIcon,
  MobileMenuLine,
  MobileMenuLineMiddle,
  MobileMenuLineBottom,
  MobileMenuDropdown,
  MobileMenuContent,
  MobileMenuItem,
  ThemeButton,
} from './ui/navigation'

export default function Navigation() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Use system as fallback before mount to avoid hook ordering issues
  const currentTheme = mounted ? theme : 'system'

  return (
    <NavContainer>
      <NavBar>
        <NavContent>
          <NavHeader>
            <LogoContainer>
              <LogoText>Veree</LogoText>
            </LogoContainer>

            {/* Desktop Navigation */}
            <DesktopNav>
              <ThemeButton
                active={currentTheme === 'light'}
                onClick={() => handleThemeChange('light')}
                title='Light mode'
                aria-label='Light mode'
              >
                <Sun size={16} />
              </ThemeButton>
              <ThemeButton
                active={currentTheme === 'dark'}
                onClick={() => handleThemeChange('dark')}
                title='Dark mode'
                aria-label='Dark mode'
              >
                <Moon size={16} />
              </ThemeButton>
              <ThemeButton
                active={currentTheme === 'system'}
                onClick={() => handleThemeChange('system')}
                title='System preference'
                aria-label='System preference'
              >
                <Monitor size={16} />
              </ThemeButton>
            </DesktopNav>

            {/* Mobile Menu Button */}
            <MobileMenuButton
              onClick={toggleMobileMenu}
              aria-label='Toggle mobile menu'
            >
              <MobileMenuIcon>
                <MobileMenuLine state={isMobileMenuOpen ? 'open' : 'closed'} />
                <MobileMenuLineMiddle
                  state={isMobileMenuOpen ? 'open' : 'closed'}
                />
                <MobileMenuLineBottom
                  state={isMobileMenuOpen ? 'open' : 'closed'}
                />
              </MobileMenuIcon>
            </MobileMenuButton>
          </NavHeader>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <MobileMenuDropdown>
              <MobileMenuContent>
                <MobileMenuItem>
                  <ThemeButton
                    active={currentTheme === 'light'}
                    onClick={() => handleThemeChange('light')}
                    title='Light mode'
                    aria-label='Light mode'
                  >
                    <Sun size={16} />
                  </ThemeButton>
                  <ThemeButton
                    active={currentTheme === 'dark'}
                    onClick={() => handleThemeChange('dark')}
                    title='Dark mode'
                    aria-label='Dark mode'
                    ml={2}
                  >
                    <Moon size={16} />
                  </ThemeButton>
                  <ThemeButton
                    active={currentTheme === 'system'}
                    onClick={() => handleThemeChange('system')}
                    title='System preference'
                    aria-label='System preference'
                    ml={2}
                  >
                    <Monitor size={16} />
                  </ThemeButton>
                </MobileMenuItem>
              </MobileMenuContent>
            </MobileMenuDropdown>
          )}
        </NavContent>
      </NavBar>
    </NavContainer>
  )
}
