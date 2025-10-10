'use client'

interface UserStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onLogout: () => void
  user: {
    email?: string
    address?: string
    chain?: string
  }
}

export default function UserStatusModal({
  isOpen,
  onClose,
  onLogout,
  user,
}: UserStatusModalProps) {
  const handleLogout = () => {
    onLogout()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]'
        onClick={onClose}
      />

      {/* Modal */}
      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-md mx-4'>
        <div className='relative bg-brand-sage-light/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-mint/30 p-8'>
          {/* Close Button */}
          <button
            onClick={onClose}
            className='absolute top-4 right-4 p-2 rounded-xl bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 hover:border-brand-mint/70 transition-all duration-300 shadow-lg hover:shadow-xl border border-transparent'
            aria-label='Close modal'
          >
            <svg
              className='w-4 h-4 text-brand-cream'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>

          {/* Inner shadow for depth */}
          <div className='absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] pointer-events-none' />

          {/* Outer glow */}
          <div className='absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-mint/20 to-transparent opacity-50 blur-sm -z-10' />

          <div className='relative'>
            {/* Success Icon */}
            <div className='flex justify-center mb-6'>
              <div className='w-20 h-20 bg-brand-mint/30 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg'>
                <svg
                  className='w-10 h-10 text-brand-cream drop-shadow-sm'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className='text-2xl font-semibold text-brand-cream text-center mb-6'>
              Welcome to the resume verification platform!
            </h2>

            {/* User Info Card */}
            <div className='bg-brand-sage/30 backdrop-blur-sm rounded-2xl p-6 border border-brand-mint/20 shadow-lg mb-6'>
              <div className='space-y-4 text-sm'>
                {user.email && (
                  <div className='flex justify-between items-center'>
                    <span className='font-medium text-brand-cream/70'>
                      Email:
                    </span>
                    <span className='text-brand-cream'>{user.email}</span>
                  </div>
                )}
                {user.address && (
                  <div className='flex justify-between items-center'>
                    <span className='font-medium text-brand-cream/70'>
                      Wallet:
                    </span>
                    <span className='text-brand-cream font-mono text-xs'>
                      {user.address.slice(0, 8)}...{user.address.slice(-6)}
                    </span>
                  </div>
                )}
                {user.chain && (
                  <div className='flex justify-between items-center'>
                    <span className='font-medium text-brand-cream/70'>
                      Network:
                    </span>
                    <span className='text-brand-cream'>{user.chain}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className='w-full px-6 py-4 text-brand-sage font-semibold bg-brand-mint rounded-xl hover:bg-brand-mint/80 transition-all duration-300 shadow-lg hover:shadow-xl'
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
