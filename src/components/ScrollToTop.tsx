'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function ScrollToTop() {
  const { theme } = useTheme()
  const [isVisible, setIsVisible] = useState(false)

  // Show button when page is scrolled down
  useEffect(() => {
    const toggleVisibility = () => {
      // Show button when user scrolls down more than 300px
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  // Scroll to top smoothly
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  if (!isVisible) return null

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-40 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 ${
        isDarkTheme(theme)
          ? 'bg-teal-600 text-white hover:bg-teal-500'
          : 'bg-teal-600 text-white hover:bg-teal-700'
      }`}
      aria-label="Scroll to top"
    >
      <ChevronUp className="w-6 h-6" strokeWidth={2.5} />
    </button>
  )
}
