'use client'

import { useState, useRef, useEffect } from 'react'
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
  onConsentSigned: () => void
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
}: BackgroundCheckDisclosureProps) {
  const { theme } = useTheme()
  const printRef = useRef<HTMLDivElement>(null)

  const [profile, setProfile] = useState<DriverProfileInfo | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [stateNoticesOpen, setStateNoticesOpen] = useState(false)
  const [fcraRightsOpen, setFcraRightsOpen] = useState(false)

  const [signedName, setSignedName] = useState('')
  const [signedDate] = useState(new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }))

  const [submitting, setSubmitting] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    fetchDriverProfile()
  }, [userAddress])

  const fetchDriverProfile = async () => {
    try {
      const response = await fetch('/api/candidate/profile-info', {
        headers: { 'x-wallet-address': userAddress },
      })
      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
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

    setError(null)
    setSubmitting(true)

    try {
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
      onConsentSigned()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!printRef.current) return
    setGeneratingPdf(true)

    try {
      // Dynamically import to keep bundle lean
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const imgW = pageW - margin * 2
      const imgH = (canvas.height * imgW) / canvas.width

      let remaining = imgH
      let yOffset = margin

      pdf.addImage(imgData, 'PNG', margin, yOffset, imgW, imgH)
      remaining -= pageH - yOffset - margin

      // Add additional pages if needed for long documents
      while (remaining > 0) {
        pdf.addPage()
        const yPos = -(imgH - remaining) - margin
        pdf.addImage(imgData, 'PNG', margin, yPos, imgW, imgH)
        remaining -= pageH
      }

      const nameSlug = signedName.replace(/\s+/g, '_') || 'Driver'
      pdf.save(`Background_Check_Disclosure_${nameSlug}_${signedDate.replace(/\//g, '-')}.pdf`)
    } finally {
      setGeneratingPdf(false)
    }
  }

  const isDark = theme === 'dark'
  const overlayBg = isDark ? 'bg-gray-950' : 'bg-gray-100'
  const headerBg = isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
  const footerBg = isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600'

  return (
    <div className={`fixed inset-0 z-[10002] flex flex-col ${overlayBg}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${headerBg}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isDark ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
            <Shield className="w-5 h-5 text-teal-500" />
          </div>
          <div>
            <h2 className={`font-semibold ${textPrimary}`}>Background Check Disclosure & Authorization</h2>
            <p className={`text-sm ${textSecondary}`}>Requested by {companyName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* The white document area — always light for print clarity */}
        <div className="max-w-3xl mx-auto py-8 px-4">
          <div
            ref={printRef}
            className="bg-white text-gray-900 rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Document Header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-8 py-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-6 h-6" />
                <span className="text-sm font-medium uppercase tracking-widest opacity-90">
                  StormChain Verified Document
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
                    <strong className="text-gray-900">{companyName}</strong> will order an investigative or a consumer
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
                    <strong className="text-gray-900">{companyName}</strong> to order my background report, including
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
                      <FormField label="Last Name, First Name, Middle" value={profile ? `${profile.lastName}, ${profile.firstName}` : ''} />
                      <FormField label="Driver's License Number" value={profile?.dlNumber || ''} />
                      <FormField label="DL State Issued" value={profile?.dlState || ''} />
                      <FormField label="Date of Birth" value={profile?.dateOfBirth || ''} />
                      <FormField label="Current Address" value={profile?.address || ''} />
                      <FormField label="City / State / ZIP" value={profile ? `${profile.city}, ${profile.state} ${profile.zip}` : ''} />
                      <FormField label="Email Address" value={profile?.email || ''} />
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
                      Signed via StormChain — {new Date().toISOString()}
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
                <span>StormChain Verified</span>
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
                Authorization sent to {companyName}
              </div>
              <div className="flex-1" />
              <button
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
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
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
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
                Sign & Authorize
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FormField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 min-h-[36px] text-sm">
        {value || <span className="text-gray-300 italic">—</span>}
      </div>
    </div>
  )
}
