'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Box,
  Container,
  Grid,
  GridItem,
  VStack,
  HStack,
  Text,
  Heading,
  Icon,
  Spacer,
  Skeleton,
  SkeletonText,
} from '@chakra-ui/react'
import { FileText, User, Search, ChevronRight } from 'lucide-react'
import Navigation from '@/components/Navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Dynamic imports to avoid SSR issues with Alchemy hooks
const ResumeUploadWithVerification = dynamic(
  () => import('@/components/ResumeUploadWithVerification'),
  {
    ssr: false,
    loading: () => (
      <Card variant='elevated' size='lg'>
        <VStack gap={4} align='stretch'>
          <Skeleton height='24px' />
          <Skeleton height='16px' />
          <Skeleton height='40px' />
          <Skeleton height='128px' />
        </VStack>
      </Card>
    ),
  }
)

const MultiMethodAuth = dynamic(() => import('@/components/EmailOTPAuth'), {
  ssr: false,
  loading: () => (
    <Card variant='elevated' size='md'>
      <VStack gap={4} align='stretch'>
        <Skeleton height='24px' />
        <Skeleton height='16px' />
        <Skeleton height='40px' />
      </VStack>
    </Card>
  ),
})

const DriverApplication = dynamic(
  () => import('@/components/DriverApplication'),
  {
    ssr: false,
    loading: () => (
      <Card variant='elevated' size='lg'>
        <VStack gap={4} align='stretch'>
          <Skeleton height='32px' />
          <SkeletonText noOfLines={4} />
          <Skeleton height='200px' />
        </VStack>
      </Card>
    ),
  }
)

const WalletTransactions = dynamic(
  () =>
    import('@/components/WalletTransactions').then((mod) => ({
      default: mod.WalletTransactions,
    })),
  {
    ssr: false,
    loading: () => (
      <Card variant='elevated' size='md'>
        <VStack gap={4} align='stretch'>
          <Skeleton height='24px' />
          <Skeleton height='120px' />
        </VStack>
      </Card>
    ),
  }
)

const QuickStats = dynamic(() => import('@/components/QuickStats'), {
  ssr: false,
  loading: () => (
    <Card variant='elevated' size='md'>
      <VStack gap={3} align='stretch'>
        <Skeleton height='20px' />
        <Skeleton height='16px' />
        <Skeleton height='16px' />
      </VStack>
    </Card>
  ),
})

const Home = () => {
  const [user, setUser] = useState<any>(null)

  // Stable callback to prevent infinite loops
  const handleAuthSuccess = useCallback((userData: any) => {
    console.log('✅ Multi-method authentication successful:', userData)
    setUser(userData)
  }, [])

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    console.log(`Quick action: ${action}`)
    // TODO: Implement navigation to respective pages
  }

  return (
    <Box minH='100vh' bg='bg.primary' overflowX='hidden'>
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <Container
        maxW='7xl'
        px={{ base: 4, md: 6, lg: 8 }}
        py={{ base: 4, md: 8 }}
        mt={3}
      >
        <Grid
          templateColumns={{ base: '1fr', lg: '1fr 2fr' }}
          gap={{ base: 6, lg: 8 }}
          w='full'
        >
          {/* Left Sidebar */}
          <GridItem>
            <VStack gap={6} align='stretch' pt={{ base: 16, md: 20, lg: 32 }}>
              {/* Authentication Card */}
              <MultiMethodAuth
                mode='general'
                onAuthSuccess={handleAuthSuccess}
              />

              {/* User Stats (only shown when logged in) */}
              {user && <QuickStats userAddress={user?.address} />}

              {/* Quick Actions Card */}
              <Card variant='elevated' size='md'>
                <VStack gap={4} align='stretch'>
                  <HStack gap={2}>
                    <Box w={2} h={2} bg='interactive.primary' rounded='full' />
                    <Heading size='md' textStyle='brand.heading'>
                      Quick Actions
                    </Heading>
                  </HStack>

                  <VStack gap={2} align='stretch'>
                    <Button
                      variant='ghost'
                      size='sm'
                      justifyContent='flex-start'
                      onClick={() => handleQuickAction('resumes')}
                    >
                      <HStack gap={3} w='full'>
                        <Icon as={FileText} boxSize={4} />
                        <Text>View My Resumes</Text>
                        <Spacer />
                        <Icon as={ChevronRight} boxSize={4} />
                      </HStack>
                    </Button>

                    <Button
                      variant='ghost'
                      size='sm'
                      justifyContent='flex-start'
                      onClick={() => handleQuickAction('profile')}
                    >
                      <HStack gap={3} w='full'>
                        <Icon as={User} boxSize={4} />
                        <Text>Update Profile</Text>
                        <Spacer />
                        <Icon as={ChevronRight} boxSize={4} />
                      </HStack>
                    </Button>

                    <Button
                      variant='ghost'
                      size='sm'
                      justifyContent='flex-start'
                      onClick={() => handleQuickAction('jobs')}
                    >
                      <HStack gap={3} w='full'>
                        <Icon as={Search} boxSize={4} />
                        <Text>Browse Jobs</Text>
                        <Spacer />
                        <Icon as={ChevronRight} boxSize={4} />
                      </HStack>
                    </Button>
                  </VStack>
                </VStack>
              </Card>
            </VStack>
          </GridItem>

          {/* Main Content Area */}
          <GridItem>
            <VStack gap={8} align='stretch' pt={{ base: 16, md: 20, lg: 32 }}>
              {/* Authentication Required Alert */}
              {!user && (
                <Card
                  variant='outline'
                  size='md'
                  bg='yellow.50'
                  borderColor='yellow.200'
                >
                  <HStack gap={3}>
                    <Box
                      w={6}
                      h={6}
                      bg='yellow.400'
                      rounded='full'
                      display='flex'
                      alignItems='center'
                      justifyContent='center'
                    >
                      <Text fontSize='sm' color='white'>
                        !
                      </Text>
                    </Box>
                    <VStack align='start' gap={1}>
                      <Text fontWeight='semibold' color='yellow.800'>
                        Authentication Required
                      </Text>
                      <Text fontSize='sm' color='yellow.700'>
                        Please log in to access the driver application and other
                        features.
                      </Text>
                    </VStack>
                  </HStack>
                </Card>
              )}

              {/* Resume Upload */}
              <ResumeUploadWithVerification user={user} />

              {/* Driver Application */}
              <DriverApplication user={user} />

              {/* Wallet Transactions */}
              {user && <WalletTransactions />}
            </VStack>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  )
}

export default Home
