'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  /** Optional label shown in the error UI (e.g. "Driver Hub") */
  section?: string
  /** Optional custom fallback. If not provided, shows a default error card. */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary — wraps major sections so a crash in one area doesn't
 * take down the whole app. Provides a "Try again" button that re-mounts.
 *
 * Usage:
 *   <ErrorBoundary section="Driver Hub">
 *     <DriverHub ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.section ?? 'Section'} crashed:`, error, info)
  }

  handleRetry = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className='flex items-center justify-center min-h-[300px] p-8'>
          <div className='max-w-md w-full rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center shadow-lg'>
            <div className='text-4xl mb-4'>⚠️</div>
            <h2 className='text-xl font-bold text-red-800 dark:text-red-300 mb-2'>
              Something went wrong
              {this.props.section ? ` in ${this.props.section}` : ''}
            </h2>
            <p className='text-sm text-red-600 dark:text-red-400 mb-6'>
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={this.handleRetry}
              className='inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors'
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
