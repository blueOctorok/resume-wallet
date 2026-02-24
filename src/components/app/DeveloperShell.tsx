'use client'

import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import { useUIStore } from '@/stores'

const DeveloperHub = dynamic(
  () => import('@/components/DeveloperHub').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading Developer Hub...' fullScreen={false} />,
  }
)

const PortfolioPage = dynamic(
  () => import('@/components/developer/PortfolioPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading Portfolio...' fullScreen={false} />,
  }
)

interface DeveloperShellProps {
  userAddress: string
}

/**
 * DeveloperShell - Contains all developer-role pages and routing.
 * Reads currentPage from UIStore; no page state props needed.
 */
export default function DeveloperShell({ userAddress }: DeveloperShellProps) {
  const { currentPage, setCurrentPage } = useUIStore()

  const goBack = () => setCurrentPage(null)

  // Default: Developer Hub
  if (!currentPage) {
    return (
      <DeveloperHub
        userAddress={userAddress}
        onNavigate={(page) => {
          if (
            page === 'portfolio' ||
            page === 'resume' ||
            page === 'github' ||
            page === 'jobs' ||
            page === 'applications'
          ) {
            setCurrentPage(page)
          }
        }}
      />
    )
  }

  if (currentPage === 'portfolio') {
    return <PortfolioPage userAddress={userAddress} onBack={goBack} />
  }

  return null
}
