'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useRef, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import {
  X,
  Shield,
  Download,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileCheck,
  PenLine,
  AlertTriangle,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { StateSelect } from '@/components/ui/StateSelect'
import { formatSsnDisplay, isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import { checkDlNumberIsNotName } from '@/lib/screening-validation'

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

interface BackgroundCheckDisclosureProps {
  requestId: string
  companyName: string
  userAddress: string
  onClose: () => void
  /**
   * Called once the FCRA consent is saved (or validated when `deferSubmit` is true).
   * `profile` is the candidate-typed/edited form data — useful for prefilling
   * a downstream form (e.g. PSP Step 2) so the candidate doesn't re-type
   * identical name/DL/DOB fields.
   */
  onConsentSigned: (profile?: Record<string, string>) => void
  /** Read-only mode for viewing a previously signed consent */
  viewMode?: boolean
  /** Consent ID to fetch for read-only viewing */
  consentId?: string
  /** When true, renders inline (no Modal wrapper) — used as the main page content */
  renderInline?: boolean
  /** When true, adds SSN field and auto-submits the Accio order after consent is saved */
  fulfillOrder?: boolean
  /** Called when the order has been successfully placed (only relevant with fulfillOrder) */
  onOrderPlaced?: (result: { orderId: string; orderNumber: string }) => void
  /**
   * When true, validate but do NOT POST the consent. The parent wizard
   * collects form data from all steps and submits them together later.
   * `onConsentSigned` still fires with the profile + `signedName` key.
   */
  deferSubmit?: boolean
  /** Pre-populate form fields when returning to this step (back navigation). */
  initialFormData?: Record<string, string> | null
}

/**
 * html2canvas parses SVG styles separately; `currentColor` / inherited colors can still
 * resolve to oklch() from the document. Strip classes and set explicit rgb() on the clone.
 */
function normalizeSvgsForHtml2Canvas(pdfRoot: Element) {
  const headerEl = pdfRoot.firstElementChild

  pdfRoot.querySelectorAll('svg').forEach(svg => {
    const cls = svg.getAttribute('class') ?? ''
    const inHeader = headerEl?.contains(svg) ?? false
    const inGreenCallout = Boolean(svg.closest('.bg-green-50'))

    let stroke = 'rgb(55, 65, 81)'
    if (inHeader) stroke = 'rgb(255, 255, 255)'
    else if (inGreenCallout || /\btext-green-(600|800)\b/.test(cls)) stroke = 'rgb(22, 101, 52)'
    else if (/\btext-teal-/.test(cls) || Boolean(svg.closest('[class*="text-teal-"]'))) stroke = 'rgb(13, 148, 136)'
    else if (/\btext-red-/.test(cls) || Boolean(svg.closest('[class*="text-red-"]'))) stroke = 'rgb(220, 38, 38)'

    svg.removeAttribute('class')
    // !important beats Tailwind on the clone; explicit rgb avoids oklch in SVG parse path
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

const STATE_NOTICES = [
  {
    state: 'California',
    text: 'You may view the file that the background check company has for you and order a copy of the file upon submitting proper identification and paying copying costs by coming to their offices during normal business hours and on reasonable notice, or by certified mail. You may also ask for a file summary by telephone.',
  },
  {
    state: 'Maine',
    text: 'If you ask us, you have the right to know whether the company ordered an investigative consumer report on you. You may request the name, address, and telephone number of the nearest office for the background check company within 5 business days of our receipt of your request. You have the right to ask the background check company for a free copy of the report.',
  },
  {
    state: 'Maryland',
    text: 'If the company obtains credit history information on you, it will be used to evaluate whether you would present an unacceptable risk of theft or other dishonest behavior in the job for which you are being considered.',
  },
  {
    state: 'Massachusetts / New Jersey',
    text: 'If you submit a request to us in writing, you have the right to know whether the company ordered an investigative consumer report from the background check company. You may inspect and order a free copy of the report by contacting the background check company.',
  },
  {
    state: 'Minnesota',
    text: 'If you submit a request to us in writing, you have the right to get from the company a complete and accurate disclosure of the nature and scope of the consumer report or investigative consumer report ordered, if any.',
  },
  {
    state: 'New York',
    text: 'If you submit a request to us in writing, you have the right to know whether the company ordered a consumer report or investigative consumer report, and you will be provided with the name and address of the background check company. You may inspect and order a free copy of the reports. By signing, you certify you have received a copy of Article 23A of the New York Correction Law.',
  },
  {
    state: 'Oregon',
    text: 'If the company obtains credit history information on you, it will be used to evaluate whether you would present an unacceptable risk of theft or other dishonest behavior.',
  },
  {
    state: 'Washington State',
    text: 'If you submit a request in writing, you have the right to get a complete and accurate disclosure of the nature and scope of the investigative consumer report ordered, if any. You also have the right to ask the background check company for a written summary of your rights under the Washington Fair Credit Reporting Act.',
  },
]

const FCRA_RIGHTS = [
  'You must be told if information in your file has been used against you.',
  'You have the right to know what is in your file.',
  'You have the right to ask for a credit score.',
  'You have the right to dispute incomplete or inaccurate information.',
  'Consumer reporting agencies must correct or delete inaccurate, incomplete, or unverifiable information within 30 days.',
  'Consumer reporting agencies may not report outdated negative information (generally 7 years old, or bankruptcies more than 10 years old).',
  'Access to your file is limited to people with a valid need.',
  'You must give your consent for reports to be provided to employers. Note: Written consent is generally not required in the trucking industry per FMCSA regulations.',
  'You may limit "prescreened" offers of credit and insurance.',
  'You have the right to place a "security freeze" on your credit report.',
  'You may seek damages from violators of the FCRA.',
  'Identity theft victims and active duty military personnel have additional rights.',
]

export default function BackgroundCheckDisclosure({
  requestId,
  companyName,
  userAddress,
  onClose,
  onConsentSigned,
  viewMode = false,
  consentId,
  renderInline = false,
  fulfillOrder = false,
  onOrderPlaced,
  deferSubmit = false,
  initialFormData,
}: BackgroundCheckDisclosureProps) {
  const { theme } = useTheme()
  const printRef = useRef<HTMLDivElement>(null)

  const [profile, setProfile] = useState<DriverProfileInfo>(() => {
    const base: DriverProfileInfo = {
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
    }
    if (initialFormData) {
      return { ...base, ...initialFormData } as DriverProfileInfo
    }
    return base
  })
  const [profileLoading, setProfileLoading] = useState(!initialFormData)
  const [viewCompanyName, setViewCompanyName] = useState(companyName)

  const [stateNoticesOpen, setStateNoticesOpen] = useState(false)
  const [fcraRightsOpen, setFcraRightsOpen] = useState(false)

  const [signedName, setSignedName] = useState(initialFormData?.signedName ?? '')
  const [signedDate, setSignedDate] = useState(
    new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  )

  const [submitting, setSubmitting] = useState(false)
  const [signed, setSigned] = useState(viewMode)
  const [error, setError] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  /** Restore collapsible state after PDF capture */
  const pdfOpenStateRef = useRef({ stateNotices: false, fcraRights: false })

  // SSN — only collected when fulfillOrder mode is active. Full 9 digits required so
  // Accio can do a direct identity match; never stored in our DB.
  const [ssn, setSsn] = useState('')
  // Order placement status (for fulfillOrder mode)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderPlacing, setOrderPlacing] = useState(false)

  useEffect(() => {
    if (viewMode && consentId) {
      fetchSignedConsent()
    } else if (!initialFormData) {
      fetchDriverProfile()
    }
  }, [userAddress, viewMode, consentId])

  const fetchSignedConsent = async () => {
    if (!consentId) return
    try {
      const response = await fetch(`/api/candidate/bgcheck-consent/${consentId}`, {
        headers: { 'x-wallet-address': userAddress },
      })
      if (response.ok) {
        const data = await response.json()
        const consent = data.consent
        setSignedName(consent.signedName || '')
        setSignedDate(
          consent.signedAt
            ? new Date(consent.signedAt).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric',
              })
            : ''
        )
        setViewCompanyName(consent.companyName || companyName)
        if (consent.formData) {
          setProfile(prev => ({ ...prev, ...consent.formData }))
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
        }
      }
    } catch {
      // Profile info is optional — form still works without it
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSign = async () => {
    if (!signedName.trim()) {
      setError('Please type your full name to sign.')
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
    const dlNameError = checkDlNumberIsNotName({
      dlNumber: profile.dlNumber,
      firstName: profile.firstName,
      lastName: profile.lastName,
    })
    if (dlNameError) {
      setError(dlNameError)
      return
    }
    if (fulfillOrder && !isValidSsn(ssn)) {
      setError('Your full 9-digit Social Security Number is required to submit the order.')
      return
    }

    setError(null)

    // Deferred mode: skip the POST, just return validated data to the parent wizard.
    if (deferSubmit) {
      onConsentSigned({ ...profile, signedName: signedName.trim() })
      return
    }

    setSubmitting(true)

    try {
      // Step 1: Save the disclosure consent
      const response = await fetch('/api/candidate/bgcheck-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          requestId,
          companyName,
          signedName: signedName.trim(),
          formData: profile,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save consent')
      }

      setSigned(true)
      onConsentSigned({ ...profile, ssn: normalizeSsnDigits(ssn) })

      // Step 2: If fulfillOrder mode, place the Accio order immediately after consent
      if (fulfillOrder) {
        setOrderPlacing(true)
        const orderRes = await fetch('/api/candidate/fulfill-screening', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': userAddress,
          },
          body: JSON.stringify({
            requestId,
            type: 'mvr',
            formData: {
              firstName: profile.firstName.trim(),
              lastName: profile.lastName.trim(),
              dob: profile.dateOfBirth.trim(),
              ssn: normalizeSsnDigits(ssn),
              dlNumber: profile.dlNumber.trim(),
              dlState: profile.dlState.trim(),
              address: profile.address.trim(),
              city: profile.city.trim(),
              state: profile.state.trim(),
              zip: profile.zip.trim(),
              email: profile.email.trim(),
            },
          }),
        })

        if (!orderRes.ok) {
          const orderData = await orderRes.json()
          throw new Error(orderData.error || 'Consent saved but failed to submit order')
        }

        const orderData = await orderRes.json()
        setOrderPlaced(true)
        setOrderPlacing(false)
        onOrderPlaced?.({ orderId: orderData.order.id, orderNumber: orderData.order.orderNumber })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
      setOrderPlacing(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!printRef.current) return
    setGeneratingPdf(true)

    // PDF is a flat image — collapsibles must be open or their body never renders.
    pdfOpenStateRef.current = { stateNotices: stateNoticesOpen, fcraRights: fcraRightsOpen }
    setStateNoticesOpen(true)
    setFcraRightsOpen(true)
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    await new Promise(r => setTimeout(r, 120))

    try {
      // Dynamically import to keep bundle lean
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const el = printRef.current
      // html2canvas cannot parse modern CSS color functions (e.g. oklch) that
      // Tailwind v4 emits. The cloned DOM gets a print-only stylesheet with sRGB.
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
            [data-bgcheck-pdf-root] {
              background: #ffffff !important;
              color: #374151 !important;
              overflow: visible !important;
            }
            [data-bgcheck-pdf-root] * {
              color: #374151 !important;
              border-color: #e5e7eb !important;
              background-color: #ffffff !important;
              background-image: none !important;
              box-shadow: none !important;
              overflow: visible !important;
              text-overflow: clip !important;
              word-break: break-word !important;
              overflow-wrap: anywhere !important;
            }
            /* Static doc: no chevron “dropdown” affordance in the capture */
            [data-bgcheck-pdf-root] section > button[type="button"] svg {
              display: none !important;
            }
            [data-bgcheck-pdf-root] section > button[type="button"] {
              cursor: default !important;
            }
            [data-bgcheck-pdf-root] > div:first-child {
              background: #0d9488 !important;
              color: #ffffff !important;
            }
            [data-bgcheck-pdf-root] > div:first-child * {
              color: #ffffff !important;
              background-color: transparent !important;
              opacity: 1 !important;
            }
            [data-bgcheck-pdf-root] .bg-gray-50,
            [data-bgcheck-pdf-root] ul.bg-gray-50,
            [data-bgcheck-pdf-root] .rounded-xl.p-4,
            [data-bgcheck-pdf-root] .rounded-xl.p-5 {
              background-color: #f9fafb !important;
            }
            [data-bgcheck-pdf-root] .bg-green-50,
            [data-bgcheck-pdf-root] .border-green-200 {
              background-color: #f0fdf4 !important;
              border-color: #bbf7d0 !important;
            }
            [data-bgcheck-pdf-root] .text-green-600,
            [data-bgcheck-pdf-root] .text-green-800 {
              color: #166534 !important;
            }
            [data-bgcheck-pdf-root] .text-teal-600,
            [data-bgcheck-pdf-root] .text-teal-700 {
              color: #0f766e !important;
            }
            [data-bgcheck-pdf-root] .bg-teal-600,
            [data-bgcheck-pdf-root] .rounded-full.bg-teal-600 {
              background-color: #0d9488 !important;
              color: #ffffff !important;
            }
            [data-bgcheck-pdf-root] .text-gray-900,
            [data-bgcheck-pdf-root] strong {
              color: #111827 !important;
            }
            [data-bgcheck-pdf-root] .text-gray-500,
            [data-bgcheck-pdf-root] .text-gray-400 {
              color: #6b7280 !important;
            }
            [data-bgcheck-pdf-root] .text-gray-700 {
              color: #374151 !important;
            }
            [data-bgcheck-pdf-root] .text-gray-800 {
              color: #1f2937 !important;
            }
            [data-bgcheck-pdf-root] .text-gray-300 {
              color: #d1d5db !important;
            }
            [data-bgcheck-pdf-root] .border-gray-300 {
              border-color: #d1d5db !important;
            }
            [data-bgcheck-pdf-root] .text-red-600 {
              color: #dc2626 !important;
            }
            [data-bgcheck-pdf-root] input {
              background-color: #f3f4f6 !important;
              color: #111827 !important;
            }
          `
          clonedDoc.head.appendChild(s)
          const pdfRoot = clonedDoc.querySelector('[data-bgcheck-pdf-root]')
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

      // Slice one tall image across pages by shifting Y (previous loop math clipped mid-lines).
      let page = 0
      while (page * usableH < imgH) {
        if (page > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', margin, margin - page * usableH, imgW, imgH)
        page += 1
      }

      const nameSlug = signedName.replace(/\s+/g, '_') || 'Driver'
      pdf.save(`Background_Check_Disclosure_${nameSlug}_${signedDate.replace(/\//g, '-')}.pdf`)
    } finally {
      setStateNoticesOpen(pdfOpenStateRef.current.stateNotices)
      setFcraRightsOpen(pdfOpenStateRef.current.fcraRights)
      setGeneratingPdf(false)
    }
  }

  const isDark = isDarkTheme(theme)
  const overlayBg = isDark ? 'bg-gray-950' : 'bg-gray-100'
  const headerBg = isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
  const footerBg = isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600'

  const content = (
    <div className={`flex flex-col ${renderInline ? 'h-full' : 'max-h-[90vh]'} ${overlayBg}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${headerBg}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isDark ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
            <Shield className="w-5 h-5 text-teal-500" />
          </div>
          <div>
            <h2 className={`font-semibold ${textPrimary}`}>
              {fulfillOrder ? 'MVR Background Check — Disclosure & Order' : 'Background Check Disclosure & Authorization'}
            </h2>
            <p className={`text-sm ${textSecondary}`}>Requested by {viewCompanyName}</p>
          </div>
        </div>
        {!renderInline && (
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* The white document area — always light for print clarity */}
        <div className="max-w-3xl mx-auto py-8 px-4">
          {/* overflow-y-visible so tall disclosure isn’t clipped before capture; PDF clone also forces visible */}
          <div
            ref={printRef}
            data-bgcheck-pdf-root
            className="bg-white text-gray-900 rounded-2xl shadow-xl overflow-x-hidden overflow-y-visible"
          >
            {/* Document Header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-8 py-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-6 h-6" />
                <span className="text-sm font-medium uppercase tracking-widest opacity-90">
                  Storm Verified Document
                </span>
              </div>
              <h1 className="text-2xl font-bold">Background Check Disclosure</h1>
              <p className="mt-1 opacity-90">Pursuant to the Fair Credit Reporting Act (FCRA)</p>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Disclosure Section */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  Disclosure
                </h2>
                <div className="bg-gray-50 rounded-xl p-5 space-y-3 text-sm text-gray-700 leading-relaxed">
                  <p>
                    In the interest of maintaining the safety and security of our customers, employees, and property,{' '}
                    <strong className="text-gray-900">{viewCompanyName}</strong> will order an investigative or a consumer
                    report (a background report) on you in connection with your employment application, and if you are
                    hired, or already work for the company, an additional background report(s) may be ordered for
                    employment purposes if necessary.
                  </p>
                  <p>
                    The background check report will be conducted by an outside agency:{' '}
                    <strong className="text-gray-900">Key Background Screening, Inc.</strong> — Website:{' '}
                    <span className="text-teal-700">keybackground.com</span> — 3711 Chester Ave., Cleveland, OH 44114 —
                    1-800-648-6148
                  </p>
                  <p>
                    The background report may contain information concerning your character, general reputation, personal
                    characteristics, mode of living, and credit standing. The types of information that may be obtained
                    include but are not limited to: Social Security number verification; criminal, public, educational,
                    and driving records checks; verification of prior employment; reference, licensing, and certification
                    checks; drug and medical testing results.
                  </p>
                  <p>
                    The information may be obtained from private and public record sources, including personal interviews
                    with your associates, friends, and neighbors.
                  </p>
                </div>
              </section>

              {/* State Notices — collapsible */}
              <section>
                <button
                  type="button"
                  onClick={() => setStateNoticesOpen(v => !v)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                    State Law Notices
                  </h2>
                  {stateNoticesOpen ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                <p className="text-sm text-gray-500 mt-1 ml-8">
                  If you live or work in any of the states below, additional rights apply.
                </p>
                {stateNoticesOpen && (
                  <div className="mt-3 space-y-3">
                    {STATE_NOTICES.map(({ state, text }) => (
                      <div key={state} className="bg-gray-50 rounded-xl p-4 text-sm">
                        <p className="font-semibold text-gray-900 mb-1">{state}</p>
                        <p className="text-gray-700 leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* FCRA Rights — collapsible */}
              <section>
                <button
                  type="button"
                  onClick={() => setFcraRightsOpen(v => !v)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                    Summary of Your Rights Under the FCRA
                  </h2>
                  {fcraRightsOpen ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {fcraRightsOpen && (
                  <ul className="mt-3 bg-gray-50 rounded-xl p-5 space-y-2">
                    {FCRA_RIGHTS.map((right, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                        {right}
                      </li>
                    ))}
                    <li className="text-xs text-gray-500 pt-2">
                      For more information visit{' '}
                      <span className="text-teal-700">www.consumerfinance.gov/learnmore</span> or write to the Consumer
                      Financial Protection Bureau, 1700 G Street N.W., Washington, DC 20552.
                    </li>
                  </ul>
                )}
              </section>

              {/* Authorization Form */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                  Authorization
                </h2>
                <div className="bg-gray-50 rounded-xl p-5 space-y-4 text-sm text-gray-700 leading-relaxed">
                  <p>
                    After carefully reading this Background Check Disclosure and Authorization form, I authorize{' '}
                    <strong className="text-gray-900">{viewCompanyName}</strong> to order my background report, including
                    investigative or consumer report. I also authorize all relevant agencies and entities to disclose to
                    Key Background Screening, Inc. all information about or concerning me, including but not limited to
                    my past or present employers, educational institutions, law enforcement agencies, motor vehicle record
                    agencies, and all other public and private repositories of information.
                  </p>
                  <p>
                    I agree that a copy of this form is valid like the signed original. I certify that all personal
                    information I have provided is true and correct.
                  </p>

                  {profileLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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
                      <StateField
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
                      <StateField
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
                      {fulfillOrder && !viewMode && (
                        <ReadOnlyOrInput
                          label="Social Security Number"
                          value={formatSsnDisplay(ssn)}
                          onChange={v => setSsn(normalizeSsnDigits(v))}
                          inputMode="numeric"
                          pattern="\d{3}-\d{2}-\d{4}"
                          maxLength={11}
                          placeholder="123-45-6789"
                          autoComplete="off"
                          required
                        />
                      )}
                    </div>
                  )}

                  {/* State-specific free copy opt-in */}
                  <div className="pt-2 flex items-start gap-2 text-xs text-gray-500 border-t border-gray-200">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      If you live or work in <strong>California, Minnesota, or Oklahoma</strong>, you are entitled to a
                      free copy of your background check report. Contact Key Background Screening at 1-800-648-6148 to
                      request your copy.
                    </span>
                  </div>
                </div>
              </section>

              {/* Signature Block */}
              <section className="border-t-2 border-dashed border-gray-300 pt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-teal-600" />
                  Signature
                </h2>

                {signed ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800">Authorization Signed</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Signature</p>
                        <p className="font-medium text-gray-900 text-xl" style={{ fontFamily: 'cursive' }}>
                          {signedName}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Date</p>
                        <p className="font-medium text-gray-900">{signedDate}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Signed via Storm — {new Date().toISOString()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type your full legal name to sign *
                      </label>
                      <input
                        type="text"
                        value={signedName}
                        onChange={e => setSignedName(e.target.value)}
                        placeholder="Full legal name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 text-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        style={{ fontFamily: 'cursive' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="text"
                        readOnly
                        value={signedDate}
                        className="px-4 py-3 border border-gray-200 rounded-xl bg-gray-100 text-gray-500 text-sm"
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* Document Footer */}
              <div className="border-t border-gray-200 pt-4 flex items-center justify-between text-xs text-gray-400">
                <span>Key Background Screening, Inc. — 3711 Chester Ave., Cleveland OH 44114 — keybackground.com</span>
                <span>Storm Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer Actions */}
      <div className={`px-6 py-4 border-t ${footerBg}`}>
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {signed ? (
            <>
              <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                <CheckCircle className="w-4 h-4" />
                {orderPlaced
                  ? 'Order submitted — your MVR will be processed shortly'
                  : orderPlacing
                    ? 'Submitting order...'
                    : viewMode
                      ? `Signed consent for ${viewCompanyName}`
                      : `Authorization sent to ${viewCompanyName}`}
              </div>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
                title="Printable PDF with all sections expanded. PDFs are static — no interactive controls."
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  isDark
                    ? 'border-teal-500/50 text-teal-400 hover:bg-teal-500/10'
                    : 'border-teal-500 text-teal-700 hover:bg-teal-50'
                }`}
              >
                {generatingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download PDF
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  isDark
                    ? 'border-gray-700 text-gray-400 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Decline
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
                title="Printable PDF with all sections expanded. PDFs are static — no interactive controls."
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  isDark
                    ? 'border-gray-700 text-gray-400 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {generatingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Save PDF
              </button>
              <button
                onClick={handleSign}
                disabled={submitting || !signedName.trim()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  !signedName.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700'
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileCheck className="w-4 h-4" />
                )}
                {fulfillOrder ? 'Sign & Submit Order' : deferSubmit ? 'Sign & Continue' : 'Sign & Authorize'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  if (renderInline) return content

  return (
    <Modal onClose={onClose} maxWidth="max-w-full" zIndex={10002} disableBackdropClose>
      {content}
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
        <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 min-h-[36px] text-sm">
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
      />
    </div>
  )
}

function StateField({
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
        <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 min-h-[36px] text-sm">
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
      />
    </div>
  )
}
