'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { FileText, ClipboardList, Briefcase, FileCheck, Car, ArrowRight, Menu } from 'lucide-react'

interface DriverHomePageProps {
  onNavigate?: (page: 'resume' | 'dotapp' | 'jobs' | 'applications' | 'mvr') => void
}

export default function DriverHomePage({ onNavigate }: DriverHomePageProps) {
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
              <Car className="w-4 h-4" />
              <span>Driver Dashboard</span>
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
          Welcome, Driver!
          <br />
          <span
            className={
              theme === 'dark'
                ? 'bg-gradient-to-r from-brand-mint to-brand-cream bg-clip-text text-transparent'
                : ''
            }
          >
            Get Started Here
          </span>
        </h1>

        <p
          className={`text-lg sm:text-xl md:text-2xl mb-8 max-w-3xl mx-auto ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Complete your DOT driver application and manage your professional credentials
          <br className="hidden sm:block" />
          <span className="font-semibold">All in one place.</span>
        </p>

        {/* Navigation Hint */}
        <div
          className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl mb-8 ${
            theme === 'dark'
              ? 'bg-brand-sage-light/20 border border-brand-mint/30'
              : 'bg-brand-sage/10 border border-brand-sage/30'
          }`}
        >
          <Menu className={`w-5 h-5 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`} />
          <p className={`text-base ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            <span className="font-semibold">Tip:</span> Use{' '}
            <span className={`font-bold ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}>
              Driver Options
            </span>{' '}
            in the navigation menu to access all features
          </p>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="py-12 sm:py-16">
        <h2
          className={`text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          What Would You Like To Do?
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Resume Upload */}
          <button
            onClick={() => onNavigate?.('resume')}
            className={`group p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl text-left ${
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
              <FileText className="w-6 h-6" />
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Upload Resume
            </h3>
            <p
              className={`mb-4 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Upload your resume to IPFS for blockchain verification. AI will help auto-fill your application forms.
            </p>
            <div className="flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all">
              <span className={theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}>
                Get Started
              </span>
              <ArrowRight
                className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
              />
            </div>
          </button>

          {/* DOT Application */}
          <button
            onClick={() => onNavigate?.('dotapp')}
            className={`group p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl text-left ${
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
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              DOT Application
            </h3>
            <p
              className={`mb-4 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Complete your DOT driver application forms. If you've uploaded a resume, AI can pre-fill the information.
            </p>
            <div className="flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all">
              <span className={theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}>
                Start Application
              </span>
              <ArrowRight
                className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
              />
            </div>
          </button>

          {/* Order MVR */}
          {onNavigate && (
            <button
              onClick={() => onNavigate('mvr')}
              className={`group p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl text-left ${
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
                <Car className="w-6 h-6" />
              </div>
              <h3
                className={`text-xl font-bold mb-3 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Order MVR
              </h3>
              <p
                className={`mb-4 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Order your Motor Vehicle Record (MVR) to complete your driver application requirements.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all">
                <span className={theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}>
                  Order Now
                </span>
                <ArrowRight
                  className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
                />
              </div>
            </button>
          )}

          {/* Browse Jobs */}
          <button
            onClick={() => onNavigate?.('jobs')}
            className={`group p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl text-left ${
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
              <Briefcase className="w-6 h-6" />
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Browse Jobs
            </h3>
            <p
              className={`mb-4 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Explore available driver positions from verified employers. Apply with your blockchain-verified credentials.
            </p>
            <div className="flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all">
              <span className={theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}>
                View Jobs
              </span>
              <ArrowRight
                className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
              />
            </div>
          </button>

          {/* My Applications */}
          <button
            onClick={() => onNavigate?.('applications')}
            className={`group p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl text-left ${
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
              <FileCheck className="w-6 h-6" />
            </div>
            <h3
              className={`text-xl font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              My Applications
            </h3>
            <p
              className={`mb-4 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Track the status of your job applications and driver application submissions.
            </p>
            <div className="flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all">
              <span className={theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}>
                View Status
              </span>
              <ArrowRight
                className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Instructions Section */}
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
            Getting Started Guide
          </h2>

          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex gap-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                }`}
              >
                1
              </div>
              <div>
                <h4
                  className={`font-semibold mb-1 text-lg ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Upload Your Resume
                </h4>
                <p
                  className={`${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  Start by uploading your resume. It will be securely stored on IPFS (decentralized storage) and
                  verified on the blockchain. Our AI assistant will use it to help auto-fill your DOT application
                  forms.
                </p>
                <p
                  className={`mt-2 text-sm italic ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  💡 Tip: Go to{' '}
                  <span className="font-semibold">Driver Options → Resume</span> in the navigation menu
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                }`}
              >
                2
              </div>
              <div>
                <h4
                  className={`font-semibold mb-1 text-lg ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Complete Your DOT Application
                </h4>
                <p
                  className={`${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  Fill out your DOT driver application forms. If you've uploaded a resume, the AI will automatically
                  extract and pre-fill your information. Review and submit when ready.
                </p>
                <p
                  className={`mt-2 text-sm italic ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  💡 Tip: Go to{' '}
                  <span className="font-semibold">Driver Options → DOT App</span> in the navigation menu
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                }`}
              >
                3
              </div>
              <div>
                <h4
                  className={`font-semibold mb-1 text-lg ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Order Your MVR (Motor Vehicle Record)
                </h4>
                <p
                  className={`${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  Order your Motor Vehicle Record as part of the driver application process. Payment is processed via
                  USDC cryptocurrency.
                </p>
                <p
                  className={`mt-2 text-sm italic ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  💡 Tip: Go to{' '}
                  <span className="font-semibold">Driver Options → Order MVR</span> in the navigation menu
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                }`}
              >
                4
              </div>
              <div>
                <h4
                  className={`font-semibold mb-1 text-lg ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Browse and Apply for Jobs
                </h4>
                <p
                  className={`${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  Once your application is complete, browse available driver positions and apply using your
                  blockchain-verified credentials. Track all your applications in one place.
                </p>
                <p
                  className={`mt-2 text-sm italic ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  💡 Tip: Go to{' '}
                  <span className="font-semibold">Driver Options → Browse Jobs</span> or{' '}
                  <span className="font-semibold">My Applications</span> in the navigation menu
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Reminder */}
          <div
            className={`mt-8 p-6 rounded-xl border-2 ${
              theme === 'dark'
                ? 'bg-brand-mint/10 border-brand-mint/30'
                : 'bg-brand-sage/10 border-brand-sage/30'
            }`}
          >
            <div className="flex items-start gap-4">
              <Menu
                className={`w-6 h-6 flex-shrink-0 mt-1 ${
                  theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                }`}
              />
              <div>
                <h4
                  className={`font-semibold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  All Features in One Place
                </h4>
                <p
                  className={`${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  Look for the{' '}
                  <span
                    className={`font-bold ${
                      theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                    }`}
                  >
                    Driver Options
                  </span>{' '}
                  button in the navigation menu at the top of the page. It contains quick access to all driver features
                  including Resume, DOT App, Order MVR, Browse Jobs, and My Applications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

