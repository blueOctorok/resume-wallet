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
      variant='ghost'
      size='sm'
      isLoading={isLoading}
      onClick={onClick}
      className='resume-border-spin whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs transition-none hover:bg-transparent hover:text-white'
    >
      Click here to view resume
    </Button>
  )
}
