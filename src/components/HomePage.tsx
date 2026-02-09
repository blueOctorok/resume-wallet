'use client'

import { useTheme } from '@/contexts/ThemeContext'
import {
  Shield,
  FileCheck,
  Sparkles,
  ArrowRight,
  Zap,
  Briefcase,
  CreditCard,
  Code,
  Truck,
  Users,
  Star,
} from 'lucide-react'

interface HomePageProps {
  isAuthenticated: boolean
  onGetStarted: () => void
}

export default function HomePage({
  isAuthenticated,
  onGetStarted,
}: HomePageProps) {
  const { theme } = useTheme()

  return (
    <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
      {/* Hero Section */}
      <div className='text-center py-12 sm:py-16 md:py-20'>
        <div className='mb-8'>
          <div className='inline-block'>
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 ${
                theme === 'dark'
                  ? 'bg-indigo-600/10 text-indigo-500 border border-indigo-600/30'
                  : 'bg-indigo-600/10 text-indigo-700 border border-indigo-600/30'
              }`}
            >
              <Sparkles className='w-4 h-4' />
              <span>Blockchain-Verified Career Platform</span>
            </div>
          </div>
        </div>

        <h1
          className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 ${
            theme === 'dark'
              ? 'text-white'
              : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 bg-clip-text text-transparent'
          }`}
        >
          Your Career,
          <br />
          <span
            className={
              theme === 'dark'
                ? 'bg-gradient-to-r from-indigo-400 via-indigo-500 to-indigo-700 bg-clip-text text-transparent'
                : 'bg-gradient-to-r from-indigo-400 via-indigo-600 to-indigo-800 bg-clip-text text-transparent'
            }
          >
            One Verified Card
          </span>
        </h1>

        <p
          className={`text-lg sm:text-xl md:text-2xl mb-8 max-w-3xl mx-auto ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Build your Career Card. Apply to jobs instantly. Get verified
          on-chain.
          <br className='hidden sm:block' />
          <span className='font-semibold'>
            For drivers, developers, and beyond.
          </span>
        </p>

        <div className='flex flex-col sm:flex-row gap-4 justify-center items-center mb-12'>
          <button
            onClick={onGetStarted}
            className={`group px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-3xl hover:scale-105 flex items-center gap-2 ${
              theme === 'dark'
                ? 'bg-indigo-600 text-white hover:bg-indigo-600/90'
                : 'bg-indigo-700 text-white hover:bg-indigo-800'
            }`}
          >
            <span>{isAuthenticated ? 'Go to Dashboard' : 'Get Started'}</span>
            <ArrowRight className='w-5 h-5 group-hover:translate-x-1 transition-transform' />
          </button>

          <a
            href='#how-it-works'
            className={`px-8 py-4 text-lg font-semibold rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
              theme === 'dark'
                ? 'border-indigo-600 text-indigo-500 hover:bg-indigo-600/10'
                : 'border-indigo-700 text-indigo-700 hover:bg-indigo-600/10'
            }`}
          >
            Learn More
          </a>
        </div>

        {/* Trust Indicators */}
        <div className='flex flex-wrap justify-center gap-6 sm:gap-8 text-sm'>
          <div className='flex items-center gap-2'>
            <CreditCard
              className={`w-5 h-5 ${
                theme === 'dark' ? 'text-indigo-500' : 'text-indigo-700'
              }`}
            />
            <span
              className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
            >
              Career Card
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <Shield
              className={`w-5 h-5 ${
                theme === 'dark' ? 'text-indigo-500' : 'text-indigo-700'
              }`}
            />
            <span
              className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
            >
              Blockchain Verified
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <Zap
              className={`w-5 h-5 ${
                theme === 'dark' ? 'text-indigo-500' : 'text-indigo-700'
              }`}
            />
            <span
              className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
            >
              StormChain Rewards
            </span>
          </div>
        </div>
      </div>

      {/* Who It's For Section */}
      <div className='py-12 sm:py-16'>
        <h2
          className={`text-3xl sm:text-4xl font-bold text-center mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Built for Professionals
        </h2>
        <p
          className={`text-center mb-12 max-w-2xl mx-auto ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Whether you drive trucks or write code, StormChain helps you stand
          out.
        </p>

        <div className='grid md:grid-cols-2 gap-8 max-w-4xl mx-auto'>
          {/* Drivers */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              theme === 'dark'
                ? 'bg-gray-800/50 border-indigo-600/30 hover:border-indigo-600/50'
                : 'bg-white border-indigo-600/30 hover:border-indigo-600/50'
            }`}
          >
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                theme === 'dark'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-blue-100 text-blue-600'
              }`}
            >
              <Truck className='w-7 h-7' />
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Drivers
            </h3>
            <ul
              className={`space-y-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
            >
              <li className='flex items-center gap-2'>
                <FileCheck className='w-4 h-4 text-green-500' />
                DOT-compliant applications
              </li>
              <li className='flex items-center gap-2'>
                <FileCheck className='w-4 h-4 text-green-500' />
                MVR integration
              </li>
              <li className='flex items-center gap-2'>
                <FileCheck className='w-4 h-4 text-green-500' />
                AI-powered form auto-fill
              </li>
              <li className='flex items-center gap-2'>
                <FileCheck className='w-4 h-4 text-green-500' />
                Shareable Career Card
              </li>
            </ul>
          </div>

          {/* Developers */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              theme === 'dark'
                ? 'bg-gray-800/50 border-indigo-600/30 hover:border-indigo-600/50'
                : 'bg-white border-indigo-600/30 hover:border-indigo-600/50'
            }`}
          >
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                theme === 'dark'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-purple-100 text-purple-600'
              }`}
            >
              <Code className='w-7 h-7' />
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Software Engineers
            </h3>
            <ul
              className={`space-y-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
            >
              <li className='flex items-center gap-2'>
                <FileCheck className='w-4 h-4 text-green-500' />
                GitHub integration
              </li>
              <li className='flex items-center gap-2'>
                <FileCheck className='w-4 h-4 text-green-500' />
                Portfolio showcase
              </li>
              <li className='flex items-center gap-2'>
                <FileCheck className='w-4 h-4 text-green-500' />
                Verified work history
              </li>
              <li className='flex items-center gap-2'>
                <FileCheck className='w-4 h-4 text-green-500' />
                Shareable Career Card
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div id='how-it-works' className='py-12 sm:py-16'>
        <h2
          className={`text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          How It Works
        </h2>

        <div className='grid md:grid-cols-3 gap-8'>
          {/* Step 1 */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              theme === 'dark'
                ? 'bg-gray-800/50 border-indigo-600/30 hover:border-indigo-600/50'
                : 'bg-white border-indigo-600/30 hover:border-indigo-600/50'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                theme === 'dark'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-700 text-white'
              }`}
            >
              <span className='text-2xl font-bold'>1</span>
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Build Your Profile
            </h3>
            <p
              className={`${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Upload your resume or connect GitHub. Our AI extracts your
              experience and builds your profile automatically.
            </p>
          </div>

          {/* Step 2 */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              theme === 'dark'
                ? 'bg-gray-800/50 border-indigo-600/30 hover:border-indigo-600/50'
                : 'bg-white border-indigo-600/30 hover:border-indigo-600/50'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                theme === 'dark'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-700 text-white'
              }`}
            >
              <span className='text-2xl font-bold'>2</span>
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Get Your Career Card
            </h3>
            <p
              className={`${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Your credentials become a shareable Career Card with a QR code.
              Employers can instantly verify your qualifications.
            </p>
          </div>

          {/* Step 3 */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              theme === 'dark'
                ? 'bg-gray-800/50 border-indigo-600/30 hover:border-indigo-600/50'
                : 'bg-white border-indigo-600/30 hover:border-indigo-600/50'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                theme === 'dark'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-700 text-white'
              }`}
            >
              <span className='text-2xl font-bold'>3</span>
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Apply & Earn
            </h3>
            <p
              className={`${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Apply to jobs with one click. Earn StormChain tokens for
              completing your profile and getting verified.
            </p>
          </div>
        </div>
      </div>

      {/* Career Card Highlight */}
      <div className='py-12 sm:py-16'>
        <div
          className={`rounded-3xl p-8 sm:p-12 ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-gray-800/50 to-indigo-600/10 border-2 border-indigo-600/30'
              : 'bg-gradient-to-br from-indigo-600/10 to-indigo-500/10 border-2 border-indigo-600/30'
          }`}
        >
          <div className='grid md:grid-cols-2 gap-8 items-center'>
            <div>
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-4 ${
                  theme === 'dark'
                    ? 'bg-indigo-600/20 text-indigo-500'
                    : 'bg-indigo-600/20 text-indigo-700'
                }`}
              >
                <Star className='w-4 h-4' />
                Featured
              </div>
              <h2
                className={`text-3xl sm:text-4xl font-bold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Your Career Card
              </h2>
              <p
                className={`text-lg mb-6 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                A single, shareable link that showcases your verified
                credentials, work history, and skills. Share it anywhere, verify
                it on-chain.
              </p>
              <ul
                className={`space-y-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
              >
                <li className='flex items-center gap-3'>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                      theme === 'dark'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-700 text-white'
                    }`}
                  >
                    ✓
                  </div>
                  Scannable QR code for instant access
                </li>
                <li className='flex items-center gap-3'>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                      theme === 'dark'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-700 text-white'
                    }`}
                  >
                    ✓
                  </div>
                  Blockchain verification badge
                </li>
                <li className='flex items-center gap-3'>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                      theme === 'dark'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-700 text-white'
                    }`}
                  >
                    ✓
                  </div>
                  Privacy controls for what you share
                </li>
              </ul>
            </div>
            <div className='flex justify-center'>
              <div
                className={`relative w-64 h-40 sm:w-80 sm:h-48 rounded-2xl shadow-2xl ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-indigo-600/30'
                    : 'bg-gradient-to-br from-white to-gray-100 border border-indigo-600/30'
                }`}
              >
                {/* Card mockup */}
                <div className='absolute top-4 left-4'>
                  <div
                    className={`text-xs font-medium ${theme === 'dark' ? 'text-indigo-500' : 'text-indigo-700'}`}
                  >
                    CAREER CARD
                  </div>
                  <div
                    className={`text-lg font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    Your Name
                  </div>
                  <div
                    className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    Your Title
                  </div>
                </div>
                <div className='absolute bottom-4 right-4 flex items-center gap-2'>
                  <Shield
                    className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                  />
                  <span
                    className={`text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
                  >
                    Verified
                  </span>
                </div>
                <div
                  className={`absolute bottom-4 left-4 w-12 h-12 rounded-lg ${
                    theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
                  } flex items-center justify-center`}
                >
                  <span className='text-2xl'>📱</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className='py-12 sm:py-16'>
        <h2
          className={`text-3xl sm:text-4xl font-bold text-center mb-12 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Why StormChain?
        </h2>

        <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-6'>
          <div
            className={`p-6 rounded-xl text-center ${
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-white shadow-lg'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-indigo-600/20 text-indigo-500'
                  : 'bg-indigo-600/20 text-indigo-700'
              }`}
            >
              <Shield className='w-6 h-6' />
            </div>
            <h4
              className={`font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Permanent Records
            </h4>
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Blockchain ensures your credentials can never be lost or altered.
            </p>
          </div>

          <div
            className={`p-6 rounded-xl text-center ${
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-white shadow-lg'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-indigo-600/20 text-indigo-500'
                  : 'bg-indigo-600/20 text-indigo-700'
              }`}
            >
              <Zap className='w-6 h-6' />
            </div>
            <h4
              className={`font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              AI-Powered
            </h4>
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Auto-fill forms and build profiles from your resume or GitHub.
            </p>
          </div>

          <div
            className={`p-6 rounded-xl text-center ${
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-white shadow-lg'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-indigo-600/20 text-indigo-500'
                  : 'bg-indigo-600/20 text-indigo-700'
              }`}
            >
              <Briefcase className='w-6 h-6' />
            </div>
            <h4
              className={`font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              One-Click Apply
            </h4>
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Apply to jobs instantly with your verified Career Card.
            </p>
          </div>

          <div
            className={`p-6 rounded-xl text-center ${
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-white shadow-lg'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-indigo-600/20 text-indigo-500'
                  : 'bg-indigo-600/20 text-indigo-700'
              }`}
            >
              <Star className='w-6 h-6' />
            </div>
            <h4
              className={`font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Earn Rewards
            </h4>
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Earn StormChain tokens for building your verified profile.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className='text-center py-12 sm:py-16'>
        <h2
          className={`text-3xl sm:text-4xl font-bold mb-6 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Ready to Build Your Career Card?
        </h2>
        <p
          className={`text-lg mb-8 max-w-2xl mx-auto ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          {isAuthenticated
            ? 'Head to your dashboard to complete your profile and start applying.'
            : 'Join thousands of professionals who trust StormChain for verified credentials.'}
        </p>
        <button
          onClick={onGetStarted}
          className={`group px-10 py-5 text-xl font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-3xl hover:scale-105 inline-flex items-center gap-3 ${
            theme === 'dark'
              ? 'bg-indigo-600 text-white hover:bg-indigo-600/90'
              : 'bg-indigo-700 text-white hover:bg-indigo-800'
          }`}
        >
          <span>
            {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
          </span>
          <ArrowRight className='w-6 h-6 group-hover:translate-x-1 transition-transform' />
        </button>
      </div>
    </div>
  )
}
