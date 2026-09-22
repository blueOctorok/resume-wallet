'use client'

import type { EvConsentDocument } from '@/lib/ev-consent-documents'

/**
 * Verbatim renderer for an EV consent document (docs/EV_CONSENT_STACK.md).
 * The artifact stores a sha256 of the serialized text — so this component
 * renders exactly the resolved sections, nothing added or dropped.
 */
export default function EvConsentDocumentView({ document }: { document: EvConsentDocument }) {
  return (
    <div className='space-y-4 text-sm leading-relaxed text-[#173150]'>
      <p className='text-xs uppercase tracking-wide text-[#173150]/55'>
        Version {document.version}
      </p>
      {document.sections.map((section, i) => (
        <section key={i}>
          {section.heading && (
            <h4 className='mb-1 font-semibold text-[#173150]'>{section.heading}</h4>
          )}
          {section.paragraphs?.map((p, j) => (
            <p key={j} className='mb-2'>
              {p}
            </p>
          ))}
          {section.bullets && (
            <ul className='ml-5 list-disc space-y-1'>
              {section.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
