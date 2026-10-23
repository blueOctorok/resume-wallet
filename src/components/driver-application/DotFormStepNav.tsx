'use client'

import { isDotFormDark as isDarkTheme } from '@/lib/dot-form-paper'
import { useTheme } from '@/contexts/ThemeContext'
import Button from '@/components/ui/Button'
import SaveProgressButton from './SaveProgressButton'

/** Local `next dev` only — never on a production build. */
export const SHOW_FILL_TEST_DATA = process.env.NODE_ENV === 'development'

interface DotFormStepNavProps {
  currentStep: number
  onPrevious: () => void
  onNext: () => void
  nextLabel: string
  onSaveProgress?: () => Promise<boolean | undefined>
  sessionUserId?: string
  onFillTestData?: () => void
}

/** Previous | Save Progress | Next — used at the top and bottom of each DOT section. */
export default function DotFormStepNav({
  currentStep,
  onPrevious,
  onNext,
  nextLabel,
  onSaveProgress,
  sessionUserId,
  onFillTestData,
}: DotFormStepNavProps) {
  const { theme } = useTheme()

  return (
    <div
      className={`flex flex-col gap-2 border-t-2 px-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-6 ${
        isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'
      }`}
    >
      <Button
        type='button'
        variant='secondary'
        className='w-full sm:w-auto'
        onClick={onPrevious}
        disabled={currentStep === 1}
      >
        Previous
      </Button>

      <div className='flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto'>
        <SaveProgressButton
          onSaveProgress={onSaveProgress}
          sessionUserId={sessionUserId}
        />
        {SHOW_FILL_TEST_DATA && onFillTestData && (
          <button
            type='button'
            onClick={onFillTestData}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium shadow ${
              isDarkTheme(theme)
                ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300'
                : 'bg-yellow-500 text-white hover:bg-yellow-400'
            }`}
            title='Fill test data'
          >
            <span>⚡</span>
            <span>Fill Test Data</span>
          </button>
        )}
      </div>

      <Button type='button' variant='primary' className='w-full sm:w-auto' onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  )
}
