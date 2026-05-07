'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useRef, useEffect } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import {
  Download,
  Loader2,
  CheckCircle,
  PenLine,
  AlertTriangle,
  FileWarning,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { StateSelect } from '@/components/ui/StateSelect'

interface DriverProfileInfo {
  firstName: string
  lastName: string
  dateOfBirth: string
  address: string
  city: string
  state: string
  zip: string
  dlNumber: string
  dlState: string
  email: string
}

export interface PspDisclosureFormProps {
  userAddress: string
  /** Shown in FMCSA blanks: employer legal name, or "Self-Request" for candidate self-order */
  companyName: string
  onClose: () => void
  onConsentSigned: (result: { consentId: string }) => void
  /** When set, ties consent to employer request and completes `candidate_requests` */
  requestId?: string | null
  viewMode?: boolean
  consentId?: string
}

/** html2canvas: force SVG strokes to rgb for reliable capture (same idea as BackgroundCheckDisclosure). */
function normalizeSvgsForHtml2Canvas(pdfRoot: Element) {
  const headerEl = pdfRoot.firstElementChild
  pdfRoot.querySelectorAll('svg').forEach(svg => {
    const cls = svg.getAttribute('class') ?? ''
    const inHeader = headerEl?.contains(svg) ?? false
    let stroke = 'rgb(55, 65, 81)'
    if (inHeader) stroke = 'rgb(255, 255, 255)'
    else if (/\btext-amber-/.test(cls) || Boolean(svg.closest('[class*="text-amber-"]'))) stroke = 'rgb(180, 83, 9)'

    svg.removeAttribute('class')
    svg.setAttribute(
      'style',
      `color: ${stroke} !important; stroke: ${stroke} !important; fill: none !important;`,
    )
    svg.querySelectorAll('path, line, circle, polyline, polygon, rect').forEach(node => {
      const el = node as SVGElement
      const s = el.getAttribute('stroke')
      if (s && s !== 'none') el.setAttribute('stroke', stroke)
      const f = el.getAttribute('fill')
      if (f === 'currentColor') el.setAttribute('fill', stroke)
      else if (f && f !== 'none' && f !== 'transparent') el.setAttribute('fill', stroke)
    })
  })
}

/**
 * FMCSA-mandated PSP Disclosure & Authorization — language must remain whole and standalone
 * (see footer NOTICE). Do not interleave other legal copy on this screen.
 */
const FMCSA_HEADER = `THE BELOW DISCLOSURE AND AUTHORIZATION LANGUAGE IS FOR MANDATORY USE BY ALL ACCOUNT HOLDERS`

const FMCSA_DISCLOSURE_PARAS: string[] = [
  `IMPORTANT DISCLOSURE REGARDING BACKGROUND REPORTS FROM THE PSP Online Service`,

  `In connection with your application for employment with __EMPLOYER__ ("Prospective Employer"), Prospective Employer, its employees, agents or contractors may obtain one or more reports regarding your driving, and safety inspection history from the Federal Motor Carrier Safety Administration (FMCSA).`,

  `When the application for employment is submitted in person, if the Prospective Employer uses any information it obtains from FMCSA in a decision to not hire you or to make any other adverse employment decision regarding you, the Prospective Employer will provide you with a copy of the report upon which its decision was based and a written summary of your rights under the Fair Credit Reporting Act before taking any final adverse action. If any final adverse action is taken against you based upon your driving history or safety report, the Prospective Employer will notify you that the action has been taken and that the action was based in part or in whole on this report.`,

  `When the application for employment is submitted by mail, telephone, computer, or other similar means, if the Prospective Employer uses any information it obtains from FMCSA in a decision to not hire you or to make any other adverse employment decision regarding you, the Prospective Employer must provide you within three business days of taking adverse action oral, written or electronic notification: that adverse action has been taken based in whole or in part on information obtained from FMCSA; the name, address, and the toll free telephone number of FMCSA; that the FMCSA did not make the decision to take the adverse action and is unable to provide you the specific reasons why the adverse action was taken; and that you may, upon providing proper identification, request a free copy of the report and may dispute with the FMCSA the accuracy or completeness of any information or report. If you request a copy of a driver record from the Prospective Employer who procured the report, then, within 3 business days of receiving your request, together with proper identification, the Prospective Employer must send or provide to you a copy of your report and a summary of your rights under the Fair Credit Reporting Act.`,

  `Neither the Prospective Employer nor the FMCSA contractor supplying the crash and safety information has the capability to correct any safety data that appears to be incorrect. You may challenge the accuracy of the data by submitting a request to https://dataqs.fmcsa.dot.gov. If you challenge crash or inspection information reported by a State, FMCSA cannot change or correct this data. Your request will be forwarded by the DataQs system to the appropriate State for adjudication.`,

  `Any crash or inspection in which you were involved will display on your PSP report. Since the PSP report does not report, or assign, or imply fault, it will include all Commercial Motor Vehicle (CMV) crashes where you were a driver or co-driver and where those crashes were reported to FMCSA, regardless of fault. Similarly, all inspections, with or without violations, appear on the PSP report. State citations associated with Federal Motor Carrier Safety Regulations (FMCSR) violations that have been adjudicated by a court of law will also appear, and remain, on a PSP report.`,

  `The Prospective Employer cannot obtain background reports from FMCSA without your authorization.`,
]

const FMCSA_AUTH_PARAS: string[] = [
  `AUTHORIZATION`,

  `If you agree that the Prospective Employer may obtain such background reports, please read the following and sign below:`,

  `I authorize __EMPLOYER__ ("Prospective Employer") to access the FMCSA Pre-Employment Screening Program (PSP) system to seek information regarding my commercial driving safety record and information regarding my safety inspection history. I understand that I am authorizing the release of safety performance information including crash data from the previous five (5) years and inspection history from the previous three (3) years. I understand and acknowledge that this release of information may assist the Prospective Employer to make a determination regarding my suitability as an employee.`,

  `I further understand that neither the Prospective Employer nor the FMCSA contractor supplying the crash and safety information has the capability to correct any safety data that appears to be incorrect. I understand I may challenge the accuracy of the data by submitting a request to https://dataqs.fmcsa.dot.gov. If I challenge crash or inspection information reported by a State, FMCSA cannot change or correct this data. I understand my request will be forwarded by the DataQs system to the appropriate State for adjudication.`,

  `I understand that any crash or inspection in which I was involved will display on my PSP report. Since the PSP report does not report, or assign, or imply fault, I acknowledge it will include all CMV crashes where I was a driver or co-driver and where those crashes were reported to FMCSA, regardless of fault. Similarly, I understand all inspections, with or without violations, will appear on my PSP report, and State citations associated with FMCSR violations that have been adjudicated by a court of law will also appear, and remain, on my PSP report.`,
]

const FMCSA_SIGN_OFF = `I have read the above Disclosure Regarding Background Reports provided to me by Prospective Employer and I understand that if I sign this Disclosure and Authorization, Prospective Employer may obtain a report of my crash and inspection history. I hereby authorize Prospective Employer and its employees, authorized agents, and/or affiliates to obtain the information authorized above.`

const FMCSA_NOTICES: string[] = [
  `NOTICE: This form is made available to monthly account holders by NIC on behalf of the U.S. Department of Transportation, Federal Motor Carrier Safety Administration (FMCSA). Account holders are required by federal law to obtain an Applicant's written or electronic consent prior to accessing the Applicant's PSP report. Further, account holders are required by FMCSA to use the language contained in this Disclosure and Authorization form to obtain an Applicant's consent. The language must be used in whole, exactly as provided. Further, the language on this form must exist as one stand-alone document. The language may NOT be included with other consent forms or any other language.`,
  `NOTICE: The prospective employment concept referenced in this form contemplates the definition of "employee" contained at 49 C.F.R. 383.5.`,
  `LAST UPDATED 2/11/2016`,
]

function fillEmployer(text: string, employer: string) {
  return text.replace(/__EMPLOYER__/g, employer)
}

export default function PspDisclosureForm({
  userAddress,
  companyName,
  onClose,
  onConsentSigned,
  requestId,
  viewMode = false,
  consentId,
}: PspDisclosureFormProps) {
  const { theme } = useTheme()
  const printRef = useRef<HTMLDivElement>(null)

  const [profile, setProfile] = useState<DriverProfileInfo>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    dlNumber: '',
    dlState: '',
    email: '',
  })
  const [profileLoading, setProfileLoading] = useState(true)
  const [viewCompanyName, setViewCompanyName] = useState(companyName)

  const [signedName, setSignedName] = useState('')
  const [printedName, setPrintedName] = useState('')
  const [signedDate, setSignedDate] = useState(
    new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
  )

  const [submitting, setSubmitting] = useState(false)
  const [signed, setSigned] = useState(viewMode)
  const [error, setError] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const employerDisplay = viewCompanyName.trim() || companyName.trim() || 'Self-Request'

  useEffect(() => {
    if (viewMode && consentId) {
      void fetchSignedConsent()
    } else {
      void fetchDriverProfile()
    }
  }, [userAddress, viewMode, consentId])

  const fetchSignedConsent = async () => {
    if (!consentId) return
    try {
      const response = await fetch(`/api/psp/consent/${consentId}`, {
        headers: { 'x-wallet-address': userAddress },
      })
      if (response.ok) {
        const data = await response.json()
        const c = data.consent
        setSignedName(c.signedName || '')
        setPrintedName((c.formData as { printedName?: string })?.printedName || c.signedName || '')
        setSignedDate(
          c.signedAt
            ? new Date(c.signedAt).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric',
              })
            : '',
        )
        setViewCompanyName(c.companyName || companyName)
        if (c.formData && typeof c.formData === 'object') {
          const fd = c.formData as Record<string, string>
          setProfile(prev => ({
            ...prev,
            firstName: fd.firstName || prev.firstName,
            lastName: fd.lastName || prev.lastName,
            dateOfBirth: fd.dateOfBirth || prev.dateOfBirth,
            address: fd.address || prev.address,
            city: fd.city || prev.city,
            state: fd.state || prev.state,
            zip: fd.zip || prev.zip,
            dlNumber: fd.dlNumber || prev.dlNumber,
            dlState: fd.dlState || prev.dlState,
            email: fd.email || prev.email,
          }))
        }
      }
    } catch {
      setError('Failed to load signed consent')
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchDriverProfile = async () => {
    try {
      const response = await fetch('/api/candidate/profile-info', {
        headers: { 'x-wallet-address': userAddress },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setProfile(prev => ({ ...prev, ...data.profile }))
          const p = data.profile as DriverProfileInfo | undefined
          if (p?.firstName || p?.lastName) {
            setPrintedName(`${p.firstName} ${p.lastName}`.trim())
          }
        }
      }
    } catch {
      // optional
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSign = async () => {
    if (!signedName.trim()) {
      setError('Please type your full name to sign.')
      return
    }
    if (!printedName.trim()) {
      setError('Please enter your name as it should appear printed on the form.')
      return
    }
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    if (!profile.dlNumber.trim()) {
      setError("Driver's license number is required.")
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const formSnapshot = {
        ...profile,
        printedName: printedName.trim(),
      }

      const response = await fetch('/api/psp/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          requestId: requestId || undefined,
          companyName: employerDisplay,
          signedName: signedName.trim(),
          formData: formSnapshot,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save consent')
      }

      const data = await response.json()
      setSigned(true)
      onConsentSigned({ consentId: data.consentId as string })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!printRef.current) return
    setGeneratingPdf(true)
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    await new Promise(r => setTimeout(r, 120))

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const el = printRef.current
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        height: el.scrollHeight,
        windowHeight: el.scrollHeight,
        y: 0,
        onclone: clonedDoc => {
          const s = clonedDoc.createElement('style')
          s.textContent = `
            [data-psp-pdf-root] { background: #ffffff !important; color: #374151 !important; overflow: visible !important; }
            [data-psp-pdf-root] * {
              color: #374151 !important; border-color: #e5e7eb !important;
              background-color: #ffffff !important; background-image: none !important; box-shadow: none !important;
              overflow: visible !important; word-break: break-word !important; overflow-wrap: anywhere !important;
            }
            [data-psp-pdf-root] > div:first-child {
              background: #d97706 !important; color: #ffffff !important;
            }
            [data-psp-pdf-root] > div:first-child * { color: #ffffff !important; background-color: transparent !important; }
          `
          clonedDoc.head.appendChild(s)
          const pdfRoot = clonedDoc.querySelector('[data-psp-pdf-root]')
          if (pdfRoot) normalizeSvgsForHtml2Canvas(pdfRoot)
        },
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const usableW = pageW - margin * 2
      const usableH = pageH - margin * 2
      const imgW = usableW
      const imgH = (canvas.height * imgW) / canvas.width
      let page = 0
      while (page * usableH < imgH) {
        if (page > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', margin, margin - page * usableH, imgW, imgH)
        page += 1
      }
      const nameSlug = signedName.replace(/\s+/g, '_') || 'Driver'
      pdf.save(`PSP_FMCSA_Disclosure_${nameSlug}_${signedDate.replace(/\//g, '-')}.pdf`)
    } finally {
      setGeneratingPdf(false)
    }
  }

  const isDark = isDarkTheme(theme)
  const overlayBg = isDark ? 'bg-gray-950' : 'bg-gray-100'
  const footerBg = isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600'

  return (
    <Modal onClose={onClose} maxWidth="max-w-full" zIndex={10002} disableBackdropClose panelShape="block">
      <div className={`flex flex-col max-h-[90vh] ${overlayBg}`}>
        <ModalHeader
          title="PSP Disclosure & Authorization (FMCSA)"
          subtitle={`Prospective Employer: ${employerDisplay}`}
          onClose={onClose}
          variant="block"
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto py-8 px-4">
            <div
              ref={printRef}
              data-psp-pdf-root
              className="bg-white text-gray-900 rounded-xl border border-amber-200 shadow-sm overflow-x-hidden overflow-y-visible"
            >
              <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-8 py-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <FileWarning className="w-6 h-6" />
                  <span className="text-xs font-medium uppercase tracking-wide opacity-95">Stand-alone FMCSA document</span>
                </div>
                <h1 className="text-lg font-bold leading-snug">{FMCSA_HEADER}</h1>
              </div>

              <div className="px-8 py-6 space-y-4 text-sm text-gray-800 leading-relaxed">
                {FMCSA_DISCLOSURE_PARAS.map((para, i) => (
                  <p key={`d-${i}`} className={i === 0 ? 'font-bold text-gray-900' : ''}>
                    {i === 0 ? para : fillEmployer(para, employerDisplay)}
                  </p>
                ))}

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  {FMCSA_AUTH_PARAS.map((para, i) => (
                    <p key={`a-${i}`} className={i === 0 ? 'font-bold text-gray-900' : ''}>
                      {i === 0 || i === 1 ? para : fillEmployer(para, employerDisplay)}
                    </p>
                  ))}
                </div>

                <p>{FMCSA_SIGN_OFF}</p>

                {profileLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                    <ReadOnlyOrInput
                      label="First Name"
                      value={profile.firstName}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, firstName: v }))}
                      autoComplete="given-name"
                      required
                    />
                    <ReadOnlyOrInput
                      label="Last Name"
                      value={profile.lastName}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, lastName: v }))}
                      autoComplete="family-name"
                      required
                    />
                    <ReadOnlyOrInput
                      label="Driver's License Number"
                      value={profile.dlNumber}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, dlNumber: v }))}
                      required
                    />
                    <PspStateField
                      label="DL State Issued"
                      value={profile.dlState}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, dlState: v }))}
                    />
                    <ReadOnlyOrInput
                      label="Date of Birth"
                      value={profile.dateOfBirth}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, dateOfBirth: v }))}
                      type="date"
                      autoComplete="bday"
                    />
                    <ReadOnlyOrInput
                      label="Current Address"
                      value={profile.address}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, address: v }))}
                      autoComplete="street-address"
                    />
                    <ReadOnlyOrInput
                      label="City"
                      value={profile.city}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, city: v }))}
                      autoComplete="address-level2"
                    />
                    <PspStateField
                      label="State"
                      value={profile.state}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, state: v }))}
                    />
                    <ReadOnlyOrInput
                      label="ZIP Code"
                      value={profile.zip}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, zip: v }))}
                      inputMode="numeric"
                      pattern="[0-9]{5}(-[0-9]{4})?"
                      maxLength={10}
                      autoComplete="postal-code"
                      placeholder="e.g. 44114"
                    />
                    <ReadOnlyOrInput
                      label="Email Address"
                      value={profile.email}
                      readOnly={viewMode}
                      onChange={v => setProfile(p => ({ ...p, email: v }))}
                      type="email"
                      autoComplete="email"
                    />
                  </div>
                )}

                <div className="border-t-2 border-dashed border-gray-300 pt-5 space-y-3">
                  <p className="text-xs text-gray-500">Date: {signedDate}</p>
                  {signed ? (
                    <>
                      <p className="text-xs text-gray-500">Signature</p>
                      <p className="font-medium text-gray-900 text-xl" style={{ fontFamily: 'cursive' }}>
                        {signedName}
                      </p>
                      <p className="text-xs text-gray-500 pt-2">Name (Please Print)</p>
                      <p className="font-medium text-gray-900">{printedName || signedName}</p>
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-gray-700">Signature (type full legal name) *</label>
                      <input
                        type="text"
                        value={signedName}
                        onChange={e => setSignedName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        style={{ fontFamily: 'cursive' }}
                      />
                      <label className="block text-xs font-medium text-gray-700">Name (Please Print) *</label>
                      <input
                        type="text"
                        value={printedName}
                        onChange={e => setPrintedName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </>
                  )}
                </div>

                <div className="space-y-2 text-xs text-gray-600 border-t border-gray-200 pt-4">
                  {FMCSA_NOTICES.map((n, i) => (
                    <p key={i}>{n}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`px-6 py-4 border-t ${footerBg}`}>
          <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-3">
            {signed ? (
              <>
                <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                  <CheckCircle className="w-4 h-4" />
                  {viewMode ? 'Signed PSP authorization on file' : 'PSP authorization recorded'}
                </div>
                <div className="flex-1 min-w-[1rem]" />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => void handleDownloadPDF()}
                  disabled={generatingPdf}
                  isLoading={generatingPdf}
                >
                  <Download className="w-4 h-4 mr-2 inline" />
                  Download PDF
                </Button>
                <Button type="button" variant="primary" size="md" onClick={onClose}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" size="md" onClick={onClose}>
                  Decline
                </Button>
                <div className="flex-1 min-w-[1rem]" />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => void handleDownloadPDF()}
                  disabled={generatingPdf}
                  isLoading={generatingPdf}
                >
                  Save PDF
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => void handleSign()}
                  disabled={submitting || !signedName.trim() || !printedName.trim()}
                  isLoading={submitting}
                >
                  <PenLine className="w-4 h-4 mr-2 inline" />
                  Sign & Authorize
                </Button>
              </>
            )}
            {error && (
              <p className="w-full text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ReadOnlyOrInput({
  label,
  value,
  readOnly = false,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  inputMode,
  pattern,
  maxLength,
  required,
}: {
  label: string
  value: string
  readOnly?: boolean
  onChange?: (value: string) => void
  placeholder?: string
  type?: string
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'email' | 'tel'
  pattern?: string
  maxLength?: number
  required?: boolean
}) {
  if (readOnly) {
    return (
      <div>
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 min-h-[36px] text-sm">
          {value || <span className="text-gray-300 italic">—</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder ?? label}
        autoComplete={autoComplete}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
      />
    </div>
  )
}

function PspStateField({
  label,
  value,
  readOnly = false,
  onChange,
}: {
  label: string
  value: string
  readOnly?: boolean
  onChange?: (value: string) => void
}) {
  if (readOnly) {
    return (
      <div>
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 min-h-[36px] text-sm">
          {value || <span className="text-gray-300 italic">—</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <StateSelect
        value={value}
        onChange={v => onChange?.(v)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
      />
    </div>
  )
}
