/**
 * Sam Blaha's public resume. Provven only prints it.
 *
 * letterhead is portfolio: no Provven wordmark, and the QR opens blahablast.io.
 * This module is not mounted in a page, a hub block, or a career card, and it
 * writes no database row. The portfolio is the public head.
 *
 * Words follow the blahablast portfolio (profile.ts, projects.ts, resume.html).
 * Reprint with `npm run resume:sam`. That writes public/Resume.pdf on that site.
 *
 * No proof chips. A chip means an issuer signed the fact. Jobs, skills, school,
 * and Navy service here are self-reported. GitHub is a link: GitHub does not
 * sign a credential, and no Compact circuit checks one. Blockfrost is only the
 * Midnight node and indexer, not a source of facts.
 */

import type { ResumeSheet } from '@/lib/resume-sheet'

const SITE = 'https://blahablast.io'

export function samBlahaResumeSheet(): ResumeSheet {
  return {
    letterhead: 'portfolio',
    fullName: 'Sam Blaha',
    tagline: 'Software architect',
    contactLine: 'Westlake, Ohio · blahasam@gmail.com · github.com/blueOctorok',
    summary:
      'I build products end to end: web apps, zero-knowledge credentials on Midnight, and applications in Flutter. I have written software professionally since 2021, across the interface, the API, the database and, since 2025, the chain.',
    proofChips: [],
    sections: [
      {
        kind: 'roles',
        title: 'Experience',
        roles: [
          {
            title: 'Pace Drivers',
            date: 'Present',
            meta: 'Software architect · provven.com',
            bullets: [
              'Provven is built for Pace Drivers. I am co-founder, lead developer and the architect who designed it.',
              'A truck driver builds a resume, employment history and credentials once, as a Career Card they own, and reuses it for every job. Zero-knowledge proofs on Midnight let an employer confirm a fact without seeing the document behind it.',
              'A Career Card is built from blocks, such as a resume, a CDL or a DOT application, and is live from the first one. No wallets, seed phrases or tokens.',
            ],
          },
          {
            title: 'Flux Point Studios',
            date: 'Feb 2025 – Present',
            meta: 'Blockchain developer · Remote',
            bullets: [
              'Built ShardSwap, a peer-to-peer token marketplace on Cardano. Traders swap assets directly between wallets, and holders of the TALOS token unlock an AI analytics dashboard.',
              "Wallet connection for Nami and Eternl through the CIP-30 standard. Offers and swaps go through Maestro's Managed Contracts API. Next.js, React and MeshJS.",
            ],
          },
          {
            title: 'MRI Software',
            date: 'Dec 2023 – Present',
            meta: 'Full-stack developer, PHP and Laravel · Solon, Ohio',
            bullets: [
              'Worked on six core applications and their API endpoints, in Laravel and Vue.',
              'Administered the Linux servers and migrated them from Rackspace to Azure with Ansible.',
            ],
          },
          {
            title: 'We Can Code IT',
            date: 'Apr 2023 – Dec 2023',
            meta: 'Lead Java and JavaScript developer · Cleveland, Ohio',
            bullets: [
              'Built Java and JavaScript applications for the program, taught React, and mentored students.',
            ],
          },
          {
            title: 'PNC Bank',
            date: 'Jan 2021 – Mar 2023',
            meta: 'Software developer · Cleveland, Ohio',
            bullets: [
              'Automated hiring, onboarding and testing, including Playwright tests in JavaScript.',
            ],
          },
          {
            title: 'Cleveland-Cliffs',
            date: 'Sep 2015 – May 2020',
            meta: 'Support systems administrator · Cleveland, Ohio',
            bullets: [
              'IT work before software, including the systems used by the C-suite, on Windows.',
            ],
          },
        ],
      },
      {
        kind: 'roles',
        title: 'Also building',
        roles: [
          {
            title: 'Riffster',
            date: 'In development',
            meta: 'Designer and developer · riffster.xyz',
            bullets: [
              'A practice app for bass and guitar. A tab scrolls along a fretboard into a playhead, and the app listens through a cable and marks each note on time, early, late or missed.',
              "A pluck and pitch detector written for the instrument's range. A native C++ audio thread plays through the speakers while Dart reads the pitch. Opens Guitar Pro files. No account and no internet needed. Flutter, Dart, C++ and alphaTab.",
            ],
          },
        ],
      },
      {
        kind: 'pairs',
        title: 'Skills',
        pairs: [
          {
            label: 'Web',
            detail:
              'Next.js, React, TypeScript, Tailwind CSS, Supabase, PostgreSQL, PHP / Laravel, REST APIs',
          },
          {
            label: 'Blockchain',
            detail:
              'Midnight, Compact, zero-knowledge proofs, Solidity, Cardano, MeshJS, ERC-20 / ERC-721',
          },
          {
            label: 'Flutter',
            detail: 'Flutter, Dart, iOS, Android, Windows',
          },
        ],
      },
      {
        kind: 'pairs',
        title: 'Background',
        pairs: [
          {
            label: 'Dapp University',
            detail: 'Blockchain Developer Mentorship, graduated June 2025',
          },
          { label: 'We Can Code IT', detail: 'Full-stack C# bootcamp, 2020' },
          {
            label: 'Cleveland State University',
            detail: 'Coursework in networking software and computer science, 2011–2013',
          },
          {
            label: 'U.S. Navy',
            detail: 'Aviation ordnance, USS Ronald Reagan, 2007–2011',
          },
        ],
      },
    ],
    verifyUrl: SITE,
    verifyDisplayPath: 'blahablast.io',
    qrLabelTop: 'blahablast.io',
    footerTitle: 'Portfolio',
    footerBody: 'The work behind this page is on the site. Nothing here is a verified credential.',
    thinStateHint: null,
    freshnessNote: null,
    hasVerifiedClaims: false,
    expiresLabel: '',
  }
}
