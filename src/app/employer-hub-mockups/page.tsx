import type { Metadata } from 'next'
import EmployerHubMockups from '@/components/employer/mockups/EmployerHubMockups'

export const metadata: Metadata = {
  title: 'Employer Hub — Layout Studies',
  description: 'Three alternate arrangements of the employer hub, built on BlockCard + HubSectionPanel.',
}

export default function EmployerHubMockupsPage() {
  return <EmployerHubMockups />
}
