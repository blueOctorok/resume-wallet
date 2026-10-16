'use client'

import Button from '@/components/ui/Button'

/**
 * The resume opener. It lives in the top-right of the career card, not in the
 * page toolbar, so a driver and an employer find it in the same place.
 */
export default function ViewResumeCornerButton({
  onClick,
  isLoading = false,
}: {
  onClick: () => void
  isLoading?: boolean
}) {
  return (
    <Button
      type='button'
      variant='primary'
      size='sm'
      isLoading={isLoading}
      onClick={onClick}
      className='whitespace-nowrap !px-3 !py-1.5 !text-xs'
    >
      Click here to view resume
    </Button>
  )
}
