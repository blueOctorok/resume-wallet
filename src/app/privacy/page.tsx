import type { Metadata } from 'next'
import LegalShell from '@/components/legal/LegalShell'
import {
  SITE_LEGAL,
  SMS_CONSENT_LANGUAGE,
  SMS_NO_SELL_PREFERRED,
} from '@/lib/site-legal'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${SITE_LEGAL.brand} collects, uses, and shares information, including SMS opt-in.`,
}

export default function PrivacyPage() {
  return (
    <LegalShell title='Privacy Policy' updated='September 17, 2026'>
      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          Who we are
        </h2>
        <p>
          {SITE_LEGAL.brand} ({SITE_LEGAL.url}) is a career-identity platform. Candidates
          build a Career Card and complete application steps. Employers use Provven to
          invite applicants and run authorized screening. Contact us at{' '}
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
          Information we collect
        </h2>
        <p>
          We collect account information (name, email, phone when you or an employer
          provide it), Career Card and application data you enter, and screening records
          produced by licensed consumer reporting agencies after you authorize them.
          We also collect technical logs needed to operate the service (for example
          sign-in and invite delivery).
        </p>
      </section>

      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          How we use information
        </h2>
        <p>
          We use this information to operate Provven: accounts, invites, application
          workflows, and authorized screening. We do not sell personal information.
        </p>
      </section>

      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          Mobile information
        </h2>
        <p>{SMS_NO_SELL_PREFERRED}</p>
      </section>

      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          Communications and opt-out
        </h2>
        <p>{SMS_CONSENT_LANGUAGE}</p>
        <p className='mt-3'>
          After you agree, we may send a confirmation text and then application
          messages from Provven (for example a link to start your application). Reply
          STOP to opt out at any time. Reply HELP for help. Email us at{' '}
          <a
            href={`mailto:${SITE_LEGAL.contactEmail}`}
            className='underline underline-offset-2'
          >
            {SITE_LEGAL.contactEmail}
          </a>{' '}
          if you need support.
        </p>
      </section>

      <section>
        <h2 className='mb-2 text-base font-semibold text-[#173150] dark:text-gray-100'>
          Service providers
        </h2>
        <p>
          We use vendors to deliver email and SMS, host the product, and process
          authorized screening. Those vendors only receive what they need to perform
          that work.
        </p>
      </section>
    </LegalShell>
  )
}
