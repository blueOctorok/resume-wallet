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
      variant='secondary'
      size='sm'
      isLoading={isLoading}
      onClick={onClick}
      className='animate-resume-corner-glow whitespace-nowrap !border-retro-teal !bg-retro-teal !px-3 !py-1.5 !text-xs !text-white hover:!bg-retro-teal hover:brightness-110 dark:!border-retro-teal dark:!bg-retro-teal dark:!text-white'
    >
      Click here to view resume
    </Button>
  )
}
