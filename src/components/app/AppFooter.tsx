'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ClipboardList, CheckCircle } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ProvvenWordmark from '@/components/ui/ProvvenWordmark'
import { SealDivider, mutedText } from '@/components/landing/landing-shared'
import { SITE_LEGAL } from '@/lib/site-legal'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import { useCurrentPage } from '@/stores/ui-store'
import { useDriverSurveyStore } from '@/stores/driver-survey-store'
import {
  BENEFIT_OPTIONS,
  BENEFIT_QUESTIONS,
  CONTACT_OPTIONS,
  EASE_OPTIONS,
  LIKELY_OPTIONS,
  TIME_OPTIONS,
  type DriverSurveyAnswers,
  type SurveyOption,
} from '@/lib/driver-survey'

function ChoiceGroup({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: SurveyOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <fieldset className='space-y-2'>
      <legend className='text-sm font-medium text-gray-900 dark:text-gray-100'>{legend}</legend>
      <div className='space-y-1.5'>
        {options.map((option) => (
          <label
            key={option.value}
            className='flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-300'
          >
            <input
              type='radio'
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className='mt-0.5 accent-[#f15a2b]'
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function OpenQuestion({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className='block space-y-2'>
      <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
      />
    </label>
  )
}

function SurveyForm() {
  const draft = useDriverSurveyStore((state) => state.draft)
  const setDraft = useDriverSurveyStore((state) => state.setDraft)
  const save = useDriverSurveyStore((state) => state.save)
  const close = useDriverSurveyStore((state) => state.close)
  const isSaving = useDriverSurveyStore((state) => state.isSaving)
  const error = useDriverSurveyStore((state) => state.error)
  const submittedAt = useDriverSurveyStore((state) => state.submittedAt)

  const patch = (next: Partial<DriverSurveyAnswers>) => setDraft({ ...draft, ...next })

  return (
    <Modal onClose={close} maxWidth='max-w-2xl'>
      <ModalHeader
        title='Driver survey'
        subtitle='Separate from your DOT application. Your answers are saved to your account.'
        onClose={close}
      />
      <form
        className='space-y-8 p-4 sm:p-5'
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <section className='space-y-5'>
          <h3 className='text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
            Overall experience
          </h3>
          <ChoiceGroup
            legend='How easy was the DOT application to complete?'
            name='easeComplete'
            options={EASE_OPTIONS}
            value={draft.easeComplete}
            onChange={(easeComplete) => patch({ easeComplete })}
          />
          <ChoiceGroup
            legend='How easy was the application to navigate?'
            name='easeNavigate'
            options={EASE_OPTIONS}
            value={draft.easeNavigate}
            onChange={(easeNavigate) => patch({ easeNavigate })}
          />
          <ChoiceGroup
            legend='How long did it take you to complete the application?'
            name='timeToComplete'
            options={TIME_OPTIONS}
            value={draft.timeToComplete}
            onChange={(timeToComplete) => patch({ timeToComplete })}
          />
        </section>

        <section className='space-y-5'>
          <h3 className='text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
            How beneficial is each of these?
          </h3>
          {BENEFIT_QUESTIONS.map((question) => (
            <ChoiceGroup
              key={question.value}
              legend={question.label}
              name={question.value}
              options={BENEFIT_OPTIONS}
              value={draft.benefits[question.value] ?? ''}
              onChange={(value) =>
                patch({ benefits: { ...draft.benefits, [question.value]: value } })
              }
            />
          ))}
        </section>

        <section className='space-y-5'>
          <h3 className='text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
            Overall value
          </h3>
          <OpenQuestion
            label='Which feature do you find most valuable?'
            value={draft.mostValuable}
            onChange={(mostValuable) => patch({ mostValuable })}
          />
          <OpenQuestion
            label='Is there anything about the application that was confusing or difficult?'
            value={draft.confusing}
            onChange={(confusing) => patch({ confusing })}
          />
          <OpenQuestion
            label='What additional features or improvements would you like to see?'
            value={draft.improvements}
            onChange={(improvements) => patch({ improvements })}
          />
          <ChoiceGroup
            legend='How likely are you to use this application again for future driving opportunities?'
            name='likelyAgain'
            options={LIKELY_OPTIONS}
            value={draft.likelyAgain}
            onChange={(likelyAgain) => patch({ likelyAgain })}
          />
        </section>

        <section className='space-y-5'>
          <h3 className='text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
            Follow-up
          </h3>
          <ChoiceGroup
            legend='Would you be willing to provide additional feedback as we keep improving the application?'
            name='moreFeedback'
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={draft.moreFeedback}
            onChange={(value) =>
              patch({
                moreFeedback: value === 'yes' ? 'yes' : 'no',
                contactMethod: value === 'yes' ? draft.contactMethod : '',
              })
            }
          />
          {draft.moreFeedback === 'yes' && (
            <ChoiceGroup
              legend='What is your preferred method of contact?'
              name='contactMethod'
              options={CONTACT_OPTIONS}
              value={draft.contactMethod}
              onChange={(contactMethod) => patch({ contactMethod })}
            />
          )}
        </section>

        {error && <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>}

        <div className='flex items-center justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700'>
          <Button type='button' variant='secondary' onClick={close}>
            Cancel
          </Button>
          <Button type='submit' isLoading={isSaving}>
            {submittedAt ? 'Update survey' : 'Submit survey'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Signed-in footer. Same heritage treatment as the landing footer (gold
 * hairline, wordmark, small print) plus a link row for work that is real but
 * not part of the qualification file. Hidden during the DOT application.
 */
export default function AppFooter() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const currentPage = useCurrentPage()
  const load = useDriverSurveyStore((state) => state.load)
  const open = useDriverSurveyStore((state) => state.open)
  const isOpen = useDriverSurveyStore((state) => state.isOpen)
  const submittedAt = useDriverSurveyStore((state) => state.submittedAt)

  useEffect(() => {
    if (currentPage === 'dotapp') return
    void load()
  }, [load, currentPage])

  if (currentPage === 'dotapp') return null

  return (
    <>
      <footer className='mt-16 pb-10'>
        <SealDivider isDark={isDark} className='mb-6' />
        <div
          className={`flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left ${mutedText(isDark)}`}
        >
          <div className='flex flex-col items-center gap-1 sm:items-start'>
            <p className='text-base'>
              <ProvvenWordmark tone='auto' isDark={isDark} />
            </p>
            <p className='text-[11px]'>
              © {new Date().getFullYear()} Provven · The career card you own · Built on Midnight
            </p>
          </div>

          <nav className='flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs'>
            <button
              type='button'
              onClick={open}
              className='inline-flex items-center gap-1.5 text-ember underline-offset-2 hover:underline'
            >
              <ClipboardList className='h-3.5 w-3.5' />
              Driver survey
              {submittedAt && <CheckCircle className='h-3.5 w-3.5 text-retro-teal' aria-label='Submitted' />}
            </button>
            <Link href='/privacy' className='underline-offset-2 hover:underline'>
              Privacy Policy
            </Link>
            <Link href='/terms' className='underline-offset-2 hover:underline'>
              Terms of Service
            </Link>
            <a href={`mailto:${SITE_LEGAL.contactEmail}`} className='underline-offset-2 hover:underline'>
              {SITE_LEGAL.contactEmail}
            </a>
          </nav>
        </div>
      </footer>
      {isOpen && <SurveyForm />}
    </>
  )
}
