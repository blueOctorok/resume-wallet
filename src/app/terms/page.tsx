import type { Metadata } from 'next'
import LegalShell from '@/components/legal/LegalShell'
import { SITE_LEGAL, SMS_CONSENT_LANGUAGE } from '@/lib/site-legal'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `Terms for using ${SITE_LEGAL.brand}, including application SMS.`,
}

export default function TermsPage() {
  return (
    <LegalShell title='Terms of Service' updated='September 17, 2026'>
      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          The service
        </h2>
        <p>
          {SITE_LEGAL.brand} ({SITE_LEGAL.url}) lets candidates build a Career Card and
          complete application steps, and lets employers invite applicants and request
          authorized screening. By using Provven you agree to these terms. Questions:{' '}
          <a
            href={`mailto:${SITE_LEGAL.contactEmail}`}
            className='underline underline-offset-2'
          >
            {SITE_LEGAL.contactEmail}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          Accounts
        </h2>
        <p>
          You are responsible for the information you submit and for keeping access to
          your account secure. Do not use the service for anything unlawful.
        </p>
      </section>

      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          Screening
        </h2>
        <p>
          Background and driving-record reports are produced by licensed consumer
          reporting agencies, not by Provven. Provven is the candidate&rsquo;s agent
          for assembling application materials. Screening only runs after the
          candidate authorizes it.
        </p>
      </section>

      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          SMS terms
        </h2>
        <p>{SMS_CONSENT_LANGUAGE}</p>
        <p className='mt-3'>
          Message frequency may vary. Standard message and data rates may apply.
          Reply STOP to cancel. Reply HELP for help. Consent to SMS is not a
          condition of employment or of using other parts of Provven.
        </p>
      </section>

      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          Changes
        </h2>
        <p>
          We may update these terms as the product changes. The date at the top of
          this page is the current version. Continued use after an update means you
          accept the revised terms.
        </p>
      </section>
    </LegalShell>
  )
}
