'use client'

type ComplianceReviewProps = {
  form1Data?: unknown
  form2Data?: unknown
  form3Data?: unknown
  applicationSummary?: string
}

/**
 * Placeholder — compliance review will be rebuilt with Claude in the
 * composable hub block system. The old T Backend / Fluxpoint route was removed.
 */
export default function ComplianceReview(_props: ComplianceReviewProps) {
  return (
    <div className='rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center'>
      <p className='text-sm text-gray-500 dark:text-gray-400'>
        AI Compliance Review is being upgraded and will return soon.
      </p>
    </div>
  )
}
