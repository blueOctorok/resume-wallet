'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  ClipboardCheck,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Building2,
  User,
  ShieldCheck,
  Ban,
} from 'lucide-react'
import { 
  VerificationRequest,
  VerificationAnswers,
  YesNoPartial,
  YesNo,
  YesNoDiscuss,
  YesNoNA,
} from '@/types/employment-verification'

export default function VerifyEmploymentPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState<VerificationRequest | null>(null)
  const [applicantType, setApplicantType] = useState<'driver' | 'developer'>('driver')
  const [applicantName, setApplicantName] = useState('')
  const [requestingCompany, setRequestingCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ status: string; message: string } | null>(null)

  // Form state
  const [verifierEmail, setVerifierEmail] = useState('')
  const [verifierName, setVerifierName] = useState('')
  const [verifierTitle, setVerifierTitle] = useState('')
  const [answers, setAnswers] = useState<VerificationAnswers>({
    datesCorrect: null,
    wasTerminated: null,
    eligibleToReturn: null,
    hadAccident: null,
    failedClearinghouseTest: null,
    randomDrugTestOrRefused: null,
  })

  useEffect(() => {
    async function fetchRequest() {
      try {
        setLoading(true)
        const response = await fetch(`/api/verification/respond/${token}`)
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to load verification request')
        }

        const data = await response.json()
        setRequest(data.verificationRequest)
        setApplicantType(data.applicantType === 'developer' ? 'developer' : 'driver')
        setApplicantName(data.applicantName ?? data.driverName ?? 'Unknown Applicant')
        setRequestingCompany(data.requestingCompanyName)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load verification request')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchRequest()
    }
  }, [token])

  const handleSubmit = async (action: 'verify' | 'deny' | 'decline') => {
    if (!verifierEmail || !verifierName) {
      alert('Please enter your email and name')
      return
    }

    // Validate answers for verify/deny (developer = 3 questions; driver = all 6)
    if (action !== 'decline') {
      const required = !answers.datesCorrect || !answers.wasTerminated || !answers.eligibleToReturn
      const driverOnly =
        applicantType === 'driver' &&
        (!answers.hadAccident || !answers.failedClearinghouseTest || !answers.randomDrugTestOrRefused)
      if (required || driverOnly) {
        alert(
          applicantType === 'developer'
            ? 'Please answer all verification questions (dates, termination, eligible to return).'
            : 'Please answer all verification questions'
        )
        return
      }
    }

    try {
      setSubmitting(true)
      const response = await fetch(`/api/verification/respond/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verifierEmail,
          verifierName,
          verifierTitle,
          action,
          answers: action !== 'decline' ? answers : undefined,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit verification')
      }

      setSubmitted(true)
      setSubmitResult({ status: data.status, message: data.message })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit verification')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-400" />
          <p className="text-gray-400">Loading verification request...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Verification Unavailable</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  // Submitted state
  if (submitted && submitResult) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 text-center">
          {submitResult.status === 'VERIFIED' || submitResult.status === 'PARTIALLY_VERIFIED' ? (
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : submitResult.status === 'VERIFICATION_DECLINED' ? (
            <Ban className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          )}
          <h1 className="text-xl font-bold text-white mb-2">
            {submitResult.status === 'VERIFIED' ? 'Verification Complete' :
             submitResult.status === 'PARTIALLY_VERIFIED' ? 'Partial Verification Submitted' :
             submitResult.status === 'VERIFICATION_DECLINED' ? 'Declined' :
             'Response Submitted'}
          </h1>
          <p className="text-gray-400">{submitResult.message}</p>
          <p className="text-gray-500 text-sm mt-4">You can close this window.</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-mint/20 mb-4">
            <ClipboardCheck className="w-8 h-8 text-brand-mint" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Employment Verification Request</h1>
          <p className="text-gray-400">
            {requestingCompany} is requesting verification of employment
          </p>
        </div>

        {/* Applicant & Employment Info */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-brand-mint" />
            {applicantType === 'developer' ? 'Applicant Information' : 'Driver Information'}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">
                {applicantType === 'developer' ? 'Applicant Name' : 'Driver Name'}
              </p>
              <p className="text-white font-medium">{applicantName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Claimed Position</p>
              <p className="text-white font-medium">{request.claimedPosition}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Claimed Employment Period</p>
              <p className="text-white font-medium">
                {formatDate(request.claimedStartDate)} - {formatDate(request.claimedEndDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Your Company</p>
              <p className="text-white font-medium">{request.previousEmployerName}</p>
            </div>
          </div>
        </div>

        {/* Verifier Info */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-mint" />
            Your Information
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Your Email *</label>
              <input
                type="email"
                value={verifierEmail}
                onChange={(e) => setVerifierEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-mint"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Your Name *</label>
              <input
                type="text"
                value={verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-mint"
                placeholder="John Smith"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Your Title (Optional)</label>
              <input
                type="text"
                value={verifierTitle}
                onChange={(e) => setVerifierTitle(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-mint"
                placeholder="HR Manager"
              />
            </div>
          </div>
        </div>

        {/* Verification Questions */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Verification Questions</h2>
          <p className="text-gray-400 text-sm mb-6">
            {applicantType === 'developer'
              ? 'Please answer the following questions about this person’s employment at your company.'
              : 'Please answer the following questions about this driver\'s employment at your company.'}
          </p>

          <div className="space-y-6">
            {/* Q1: Dates Correct */}
            <QuestionBlock
              number={1}
              question="Were the employment dates correct?"
              options={[
                { value: 'yes', label: 'Yes, dates are correct' },
                { value: 'partial', label: 'Partially correct' },
                { value: 'no', label: 'No, dates are incorrect' },
              ]}
              value={answers.datesCorrect}
              onChange={(v) => setAnswers({ ...answers, datesCorrect: v as YesNoPartial })}
            />
            {answers.datesCorrect === 'partial' && (
              <div className="ml-6 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Correct Start Date</label>
                  <input
                    type="date"
                    value={answers.correctedStartDate || ''}
                    onChange={(e) => setAnswers({ ...answers, correctedStartDate: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-brand-mint"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Correct End Date</label>
                  <input
                    type="date"
                    value={answers.correctedEndDate || ''}
                    onChange={(e) => setAnswers({ ...answers, correctedEndDate: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-brand-mint"
                  />
                </div>
              </div>
            )}

            {/* Q2: Terminated */}
            <QuestionBlock
              number={2}
              question="Were they terminated?"
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
              value={answers.wasTerminated}
              onChange={(v) => setAnswers({ ...answers, wasTerminated: v as YesNo })}
            />
            {answers.wasTerminated === 'yes' && (
              <div className="ml-6">
                <label className="block text-sm text-gray-400 mb-1">Termination Reason (Optional)</label>
                <input
                  type="text"
                  value={answers.terminationReason || ''}
                  onChange={(e) => setAnswers({ ...answers, terminationReason: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-mint"
                  placeholder="Reason for termination"
                />
              </div>
            )}

            {/* Q3: Eligible to Return */}
            <QuestionBlock
              number={3}
              question="Are they eligible to return / would you rehire?"
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
                { value: 'discuss', label: 'Would need to discuss' },
              ]}
              value={answers.eligibleToReturn}
              onChange={(v) => setAnswers({ ...answers, eligibleToReturn: v as YesNoDiscuss })}
            />

            {/* Driver-only: FMCSA questions (Q4–Q6) */}
            {applicantType === 'driver' && (
              <>
                <QuestionBlock
                  number={4}
                  question="Were they ever in an accident while employed?"
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                  value={answers.hadAccident}
                  onChange={(v) => setAnswers({ ...answers, hadAccident: v as YesNo })}
                />
                {answers.hadAccident === 'yes' && (
                  <div className="ml-6">
                    <label className="block text-sm text-gray-400 mb-1">Accident Details</label>
                    <textarea
                      value={answers.accidentDetails || ''}
                      onChange={(e) => setAnswers({ ...answers, accidentDetails: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-mint"
                      placeholder="Brief description of accident(s)"
                      rows={2}
                    />
                  </div>
                )}

                <QuestionBlock
                  number={5}
                  question="Did they fail an FMCSA Clearinghouse post-accident test?"
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                    { value: 'na', label: 'N/A (no post-accident test required)' },
                  ]}
                  value={answers.failedClearinghouseTest}
                  onChange={(v) => setAnswers({ ...answers, failedClearinghouseTest: v as YesNoNA })}
                />

                <QuestionBlock
                  number={6}
                  question="Were they part of a random drug test pull or refused a drug test?"
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                    { value: 'na', label: 'N/A' },
                  ]}
                  value={answers.randomDrugTestOrRefused}
                  onChange={(v) => setAnswers({ ...answers, randomDrugTestOrRefused: v as YesNoNA })}
                />
              </>
            )}
            {answers.randomDrugTestOrRefused === 'yes' && (
              <div className="ml-6">
                <label className="block text-sm text-gray-400 mb-1">Details</label>
                <textarea
                  value={answers.drugTestDetails || ''}
                  onChange={(e) => setAnswers({ ...answers, drugTestDetails: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-mint"
                  placeholder="Details about drug test"
                  rows={2}
                />
              </div>
            )}

            {/* Additional Notes */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Additional Notes (Optional)</label>
              <textarea
                value={answers.additionalNotes || ''}
                onChange={(e) => setAnswers({ ...answers, additionalNotes: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-mint"
                placeholder="Any additional information about this employee"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleSubmit('verify')}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Verify Employment
          </button>
          <button
            onClick={() => handleSubmit('deny')}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
            Deny Verification
          </button>
          <button
            onClick={() => handleSubmit('decline')}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ban className="w-5 h-5" />}
            Decline to Verify
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Your response will be shared with {requestingCompany} for their hiring decision.
        </p>
      </div>
    </div>
  )
}

// Question block component
function QuestionBlock({
  number,
  question,
  options,
  value,
  onChange,
}: {
  number: number
  question: string
  options: { value: string; label: string }[]
  value: string | null
  onChange: (value: string) => void
}) {
  return (
    <div>
      <p className="text-white font-medium mb-3">
        <span className="text-brand-mint mr-2">{number}.</span>
        {question}
      </p>
      <div className="flex flex-wrap gap-2 ml-6">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              value === opt.value
                ? 'bg-brand-mint text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
