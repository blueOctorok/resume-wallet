'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Shield, FileCheck, Sparkles, ArrowRight, Zap } from 'lucide-react'

interface HomePageProps {
  isAuthenticated: boolean
  onGetStarted: () => void
}

export default function HomePage({ isAuthenticated, onGetStarted }: HomePageProps) {
  const { theme } = useTheme()

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center py-12 sm:py-16 md:py-20">
        <div className="mb-8">
          <div className="inline-block">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 ${
                theme === 'dark'
                  ? 'bg-brand-mint/10 text-brand-mint border border-brand-mint/30'
                  : 'bg-brand-sage/10 text-brand-sage border border-brand-sage/30'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Blockchain-Verified Driver Applications</span>
            </div>
          </div>
        </div>

        <h1
          className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 ${
            theme === 'dark'
              ? 'text-white'
              : 'bg-gradient-to-r from-brand-sage via-brand-sage-dark to-brand-mint bg-clip-text text-transparent'
          }`}
        >
          Your Resume,
          <br />
          <span
            className={
              theme === 'dark'
                ? 'bg-gradient-to-r from-brand-mint to-brand-cream bg-clip-text text-transparent'
                : ''
            }
          >
            Verified Forever
          </span>
        </h1>

        <p
          className={`text-lg sm:text-xl md:text-2xl mb-8 max-w-3xl mx-auto ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Submit your DOT driver application with blockchain verification.
          <br className="hidden sm:block" />
          <span className="font-semibold">Secure, permanent, and tamper-proof.</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <button
            onClick={onGetStarted}
            className={`group px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-3xl hover:scale-105 flex items-center gap-2 ${
              theme === 'dark'
                ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                : 'bg-brand-sage text-white hover:bg-brand-sage-dark'
            }`}
          >
            <span>{isAuthenticated ? 'Upload Resume' : 'Get Started'}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <a
            href="#how-it-works"
            className={`px-8 py-4 text-lg font-semibold rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
              theme === 'dark'
                ? 'border-brand-mint text-brand-mint hover:bg-brand-mint/10'
                : 'border-brand-sage text-brand-sage hover:bg-brand-sage/10'
            }`}
          >
            Learn More
          </a>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <Shield
              className={`w-5 h-5 ${
                theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
              }`}
            />
            <span
              className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
            >
              Blockchain Verified
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FileCheck
              className={`w-5 h-5 ${
                theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
              }`}
            />
            <span
              className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
            >
              DOT Compliant
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap
              className={`w-5 h-5 ${
                theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
              }`}
            />
            <span
              className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
            >
              AI-Powered Prefill
            </span>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div id="how-it-works" className="py-12 sm:py-16">
        <h2
          className={`text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              theme === 'dark'
                ? 'bg-brand-sage-light/10 border-brand-mint/30 hover:border-brand-mint/50'
                : 'bg-white border-brand-sage/30 hover:border-brand-sage/50'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                theme === 'dark'
                  ? 'bg-brand-mint text-gray-900'
                  : 'bg-brand-sage text-white'
              }`}
            >
              <span className="text-2xl font-bold">1</span>
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Upload Your Resume
            </h3>
            <p
              className={`${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Securely upload your resume to IPFS (decentralized storage) with
              blockchain verification for permanent, tamper-proof records.
            </p>
          </div>

          {/* Step 2 */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              theme === 'dark'
                ? 'bg-brand-sage-light/10 border-brand-mint/30 hover:border-brand-mint/50'
                : 'bg-white border-brand-sage/30 hover:border-brand-sage/50'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                theme === 'dark'
                  ? 'bg-brand-mint text-gray-900'
                  : 'bg-brand-sage text-white'
              }`}
            >
              <span className="text-2xl font-bold">2</span>
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              AI Auto-Fill Forms
            </h3>
            <p
              className={`${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Our AI assistant "T" analyzes your resume and automatically fills
              out your DOT driver application forms. Edit as needed.
            </p>
          </div>

          {/* Step 3 */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              theme === 'dark'
                ? 'bg-brand-sage-light/10 border-brand-mint/30 hover:border-brand-mint/50'
                : 'bg-white border-brand-sage/30 hover:border-brand-sage/50'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                theme === 'dark'
                  ? 'bg-brand-mint text-gray-900'
                  : 'bg-brand-sage text-white'
              }`}
            >
              <span className="text-2xl font-bold">3</span>
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Submit & Verify
            </h3>
            <p
              className={`${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Submit your completed application with blockchain verification.
              Your credentials are permanently stored and instantly verifiable.
            </p>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-12 sm:py-16">
        <div
          className={`rounded-3xl p-8 sm:p-12 ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-brand-sage-light/20 to-brand-mint/10 border-2 border-brand-mint/30'
              : 'bg-gradient-to-br from-brand-sage/10 to-brand-mint/10 border-2 border-brand-sage/30'
          }`}
        >
          <h2
            className={`text-3xl sm:text-4xl font-bold text-center mb-8 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Why Choose StormChain?
          </h2>

          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex gap-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                }`}
              >
                ✓
              </div>
              <div>
                <h4
                  className={`font-semibold mb-1 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Permanent Records
                </h4>
                <p
                  className={`text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  Blockchain verification ensures your credentials can never be
                  lost or altered.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                }`}
              >
                ✓
              </div>
              <div>
                <h4
                  className={`font-semibold mb-1 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Save Time
                </h4>
                <p
                  className={`text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  AI-powered auto-fill extracts information from your resume,
                  eliminating manual data entry.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                }`}
              >
                ✓
              </div>
              <div>
                <h4
                  className={`font-semibold mb-1 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Secure & Private
                </h4>
                <p
                  className={`text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  Your smart wallet ensures only you control access to your
                  data. No passwords to remember.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                }`}
              >
                ✓
              </div>
              <div>
                <h4
                  className={`font-semibold mb-1 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Instant Verification
                </h4>
                <p
                  className={`text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  Employers can instantly verify your credentials on the
                  blockchain. No more waiting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center py-12 sm:py-16">
        <h2
          className={`text-3xl sm:text-4xl font-bold mb-6 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Ready to Get Started?
        </h2>
        <p
          className={`text-lg mb-8 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          {isAuthenticated
            ? 'Upload your resume and start your DOT driver application today.'
            : 'Sign in with your wallet and complete your application in minutes.'}
        </p>
        <button
          onClick={onGetStarted}
          className={`group px-10 py-5 text-xl font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-3xl hover:scale-105 inline-flex items-center gap-3 ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
              : 'bg-brand-sage text-white hover:bg-brand-sage-dark'
          }`}
        >
          <span>{isAuthenticated ? 'Start Application' : 'Get Started Free'}</span>
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  )
}

