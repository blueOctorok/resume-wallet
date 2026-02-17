'use client'

import { useState, useEffect } from 'react'
import { 
  X, FileText, Calendar, MapPin, CreditCard, AlertCircle, 
  Shield, AlertTriangle, Car, Clock, CheckCircle, XCircle,
  Stethoscope, ChevronDown, ExternalLink, Award, Activity,
  Download, Printer
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface MvrViewModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
}

interface Violation {
  date?: string
  convictionDate?: string
  type?: string
  description?: string
  points?: number
  state?: string
  acdCode?: string
  stateCode?: string
}

interface Accident {
  date?: string
  severity?: string
  fault?: string
  description?: string
}

interface Suspension {
  date?: string
  reason?: string
  endDate?: string
  state?: string
}

interface License {
  issueDate?: string
  originalIssueDate?: string
  expirationDate?: string
  class?: string
  classDescription?: string
  type?: string
  status?: string
  cdlStatus?: string
  endorsements?: string
  restrictions?: string
}

/** Driver name from DMV record (parsed from Accio subject block) */
interface MvrSubject {
  firstName?: string
  middleName?: string
  lastName?: string
  nameSuffix?: string
}

interface MvrResult {
  id: string
  subject?: MvrSubject | null
  licenseNumber: string | null
  licenseState: string | null
  licenseClass: string | null
  licenseStatus: string | null
  licenseExpirationDate: string | null
  licenses: License[]
  totalPoints: number | null
  violationCount: number | null
  violations: Violation[]
  accidentCount: number | null
  accidents: Accident[]
  suspensionCount: number | null
  suspensions: Suspension[]
  medicalCertExpiration: string | null
  medicalCertIssueDate: string | null
  medicalCertStatus: string | null
  medicalCertSelfCertification: string | null
  cdlEndorsements: string[]
  cdlRestrictions: string[]
  resultStatus: string
  receivedAt: string
  parsedAt: string | null
}

interface MvrOrder {
  id: string
  orderNumber: string
  status: string
  orderedAt: string
  paymentId: string | null
}

interface Payment {
  id: string
  txHash: string
  amount: string
  status: string
  createdAt: string
}

/**
 * Extract clean driver name from potentially corrupted subject data.
 * 
 * Accio XML parsing sometimes produces malformed data where firstName contains
 * the entire subject block's text content concatenated, like:
 *   "Samuel Christian U 321 Vista Circle North Olmsted N N N ... Blaha"
 * 
 * Strategy:
 * 1. If lastName exists and is clean, use it
 * 2. Otherwise, assume last word of firstName blob is the last name
 * 3. For first name, take only name-like words from the start (before addresses/flags)
 */
function formatDriverName(subject: MvrSubject | undefined | null): string {
  if (!subject) return ''
  
  // Get raw values (might be XML-contaminated or have all fields mashed together)
  let rawFirst = (subject.firstName || '').replace(/<[^>]*>/g, ' ').trim()
  let rawLast = (subject.lastName || '').replace(/<[^>]*>/g, ' ').trim()
  
  // If data looks clean (short, no numbers, no single-letter garbage), use as-is
  const looksClean = (s: string) => s.length < 30 && !/\d/.test(s) && !/\b[A-Z]\b/.test(s)
  
  if (looksClean(rawFirst) && looksClean(rawLast)) {
    return [rawFirst, rawLast].filter(Boolean).join(' ')
  }
  
  // Data is corrupted - need to extract intelligently
  // Split the firstName blob into words
  const words = rawFirst.split(/\s+/).filter(Boolean)
  
  if (words.length === 0) return rawLast || ''
  
  // Helper: does this word look like a name? (capitalized, 2+ chars, no numbers)
  const isNameLike = (w: string) => 
    w.length >= 2 && 
    /^[A-Z][a-z]+$/.test(w) && 
    !['North', 'South', 'East', 'West', 'Current', 'Employment', 'Contract', 'Hire'].includes(w)
  
  // Extract first name: take leading name-like words (usually 1-2)
  const firstNames: string[] = []
  for (const word of words) {
    if (isNameLike(word) && firstNames.length < 2) {
      firstNames.push(word)
    } else if (firstNames.length > 0) {
      break // Stop once we hit non-name content
    }
  }
  
  // Extract last name: use rawLast if clean, otherwise last name-like word from blob
  let lastName = ''
  if (rawLast && isNameLike(rawLast)) {
    lastName = rawLast
  } else {
    // Find last name-like word in the blob
    for (let i = words.length - 1; i >= 0; i--) {
      if (isNameLike(words[i])) {
        lastName = words[i]
        break
      }
    }
  }
  
  // Don't include lastName if it's already in firstNames
  if (firstNames.includes(lastName)) {
    lastName = ''
  }
  
  return [...firstNames, lastName].filter(Boolean).join(' ')
}

/**
 * Format YYYYMMDD date to readable string
 */
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return 'N/A'
  
  // Handle YYYYMMDD format
  if (dateStr.length === 8 && !dateStr.includes('-')) {
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
  
  // Handle ISO format
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Get status badge styling
 */
function getStatusBadge(status: string | undefined | null): { bg: string; text: string; dot: string } {
  if (!status) return { bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-400' }
  
  const statusLower = status.toLowerCase()
  if (statusLower.includes('valid') || statusLower.includes('active') || statusLower.includes('certified') || statusLower.includes('completed')) {
    return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' }
  }
  if (statusLower.includes('expired') || statusLower.includes('suspend') || statusLower.includes('revoked')) {
    return { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-400' }
  }
  if (statusLower.includes('pending') || statusLower.includes('unknown') || statusLower.includes('review')) {
    return { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' }
  }
  return { bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-400' }
}

export default function MvrViewModal({ isOpen, onClose, walletAddress }: MvrViewModalProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mvrOrder, setMvrOrder] = useState<MvrOrder | null>(null)
  const [mvrResult, setMvrResult] = useState<MvrResult | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [showPayments, setShowPayments] = useState(false)

  // Generate printable PDF version
  const handleDownloadPDF = () => {
    if (!mvrResult || !mvrOrder) return

    // Create a new window with print-friendly content
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to download the PDF')
      return
    }

    const statusBadge = getStatusBadge(mvrResult.licenseStatus)
    const statusColor = statusBadge.text.includes('emerald') ? '#10b981' : 
                        statusBadge.text.includes('red') ? '#ef4444' : 
                        statusBadge.text.includes('amber') ? '#f59e0b' : '#6b7280'

    // Build violations HTML
    const violationsHtml = mvrResult.violations && mvrResult.violations.length > 0 
      ? mvrResult.violations.map(v => `
          <div class="violation-item">
            <div class="violation-header">
              <strong>${v.description || v.type || 'Violation'}</strong>
              ${v.acdCode ? `<span class="acd-code">ACD: ${v.acdCode}</span>` : ''}
            </div>
            <div class="violation-details">
              ${v.date ? `<span>Issue: ${formatDate(v.date)}</span>` : ''}
              ${v.convictionDate ? `<span>Conviction: ${formatDate(v.convictionDate)}</span>` : ''}
            </div>
          </div>
        `).join('')
      : '<p class="none">No violations on record</p>'

    // Build accidents HTML
    const accidentsHtml = mvrResult.accidents && mvrResult.accidents.length > 0
      ? mvrResult.accidents.map(a => `
          <div class="accident-item">
            <strong>${a.description || 'Accident'}</strong>
            <span>${formatDate(a.date)}</span>
            ${a.severity ? `<span class="severity">${a.severity}</span>` : ''}
          </div>
        `).join('')
      : '<p class="none">No accidents on record</p>'

    // Build suspensions HTML
    const suspensionsHtml = mvrResult.suspensions && mvrResult.suspensions.length > 0
      ? mvrResult.suspensions.map(s => `
          <div class="suspension-item">
            <strong>${s.reason || 'Suspension'}</strong>
            <span>From: ${formatDate(s.date)}${s.endDate ? ` to ${formatDate(s.endDate)}` : ''}</span>
          </div>
        `).join('')
      : '<p class="none">No suspensions on record</p>'

    // Build license classes HTML
    const licensesHtml = mvrResult.licenses && mvrResult.licenses.length > 0
      ? mvrResult.licenses.map(l => `
          <div class="license-class">
            <div class="class-badge">${l.class || '?'}</div>
            <div class="class-info">
              <strong>Class ${l.class} - ${l.type || 'Standard'}</strong>
              ${l.classDescription ? `<span>${l.classDescription}</span>` : ''}
              ${l.restrictions ? `<span class="restrictions">Restrictions: ${l.restrictions}</span>` : ''}
            </div>
            <span class="class-status" style="color: ${statusColor}">${l.status || 'Unknown'}</span>
          </div>
        `).join('')
      : ''

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Motor Vehicle Report${formatDriverName(mvrResult.subject) ? ` - ${formatDriverName(mvrResult.subject)}` : mvrResult.licenseNumber ? ` - ${mvrResult.licenseNumber}` : ''}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1f2937;
            line-height: 1.5;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #059669;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header-left h1 { font-size: 24px; color: #059669; margin-bottom: 4px; }
          .header-left p { color: #6b7280; font-size: 14px; }
          .header-right { text-align: right; }
          .header-right .order-num { font-family: monospace; font-size: 12px; color: #6b7280; }
          .header-right .date { font-size: 14px; color: #374151; }
          
          .license-card {
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
            border: 1px solid #bbf7d0;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
          }
          .license-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
          }
          .license-item label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
          .license-item .value { font-size: 18px; font-weight: 700; color: #1f2937; margin-top: 4px; }
          .license-item .value.mono { font-family: monospace; }
          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin-top: 4px;
          }
          .status-valid { background: #d1fae5; color: #059669; }
          .status-invalid { background: #fee2e2; color: #dc2626; }
          .status-pending { background: #fef3c7; color: #d97706; }
          .status-dot { width: 8px; height: 8px; border-radius: 50%; }
          
          .license-classes { margin-top: 20px; padding-top: 20px; border-top: 1px solid #d1fae5; }
          .license-classes h4 { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 12px; }
          .license-class {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 12px;
            background: white;
            border-radius: 8px;
            margin-bottom: 8px;
          }
          .class-badge {
            width: 48px;
            height: 48px;
            background: #e5e7eb;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 800;
            color: #374151;
          }
          .class-info { flex: 1; }
          .class-info strong { display: block; color: #1f2937; }
          .class-info span { font-size: 13px; color: #6b7280; }
          .class-info .restrictions { display: block; font-size: 12px; color: #9ca3af; }
          .class-status { font-size: 12px; font-weight: 600; }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }
          .stat-card {
            text-align: center;
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
          }
          .stat-value { font-size: 32px; font-weight: 800; }
          .stat-value.good { color: #10b981; }
          .stat-value.warning { color: #f59e0b; }
          .stat-value.bad { color: #ef4444; }
          .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }

          .section {
            margin-bottom: 24px;
          }
          .section-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          .section-header h3 { font-size: 16px; color: #1f2937; }
          .section-count {
            background: #fef3c7;
            color: #d97706;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 10px;
          }

          .violation-item, .accident-item, .suspension-item {
            padding: 12px 16px;
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            border-radius: 0 8px 8px 0;
            margin-bottom: 8px;
          }
          .violation-header { display: flex; justify-content: space-between; align-items: center; }
          .violation-details { margin-top: 4px; font-size: 13px; color: #6b7280; }
          .violation-details span { margin-right: 16px; }
          .acd-code { font-family: monospace; font-size: 11px; color: #9ca3af; }

          .none { color: #9ca3af; font-style: italic; }

          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 11px;
            color: #9ca3af;
          }
          .footer .brand { color: #059669; font-weight: 600; }

          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>Motor Vehicle Report</h1>
            <p>Official DMV Record${formatDriverName(mvrResult.subject) ? ` • ${formatDriverName(mvrResult.subject)}` : ''}</p>
          </div>
          <div class="header-right">
            <div class="order-num">Order #${mvrOrder.orderNumber}</div>
            <div class="date">${formatDate(mvrOrder.orderedAt)}</div>
          </div>
        </div>

        <div class="license-card">
          ${formatDriverName(mvrResult.subject) ? `
          <div style="margin-bottom: 20px;">
            <label style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Name on record</label>
            <div style="font-size: 22px; font-weight: 700; color: #1f2937; margin-top: 4px;">${formatDriverName(mvrResult.subject)}</div>
          </div>
          ` : ''}
          <div class="license-grid">
            <div class="license-item">
              <label>License Number</label>
              <div class="value mono">${mvrResult.licenseNumber || 'N/A'}</div>
            </div>
            <div class="license-item">
              <label>State</label>
              <div class="value">${mvrResult.licenseState || 'N/A'}</div>
            </div>
            <div class="license-item">
              <label>Status</label>
              <div class="status-badge ${mvrResult.licenseStatus?.toLowerCase().includes('valid') ? 'status-valid' : mvrResult.licenseStatus?.toLowerCase().includes('expired') ? 'status-invalid' : 'status-pending'}">
                <span class="status-dot" style="background: currentColor"></span>
                ${mvrResult.licenseStatus || 'Unknown'}
              </div>
            </div>
            <div class="license-item">
              <label>Expiration</label>
              <div class="value">${formatDate(mvrResult.licenseExpirationDate)}</div>
            </div>
          </div>
          ${licensesHtml ? `<div class="license-classes"><h4>License Classes</h4>${licensesHtml}</div>` : ''}
        </div>

        ${mvrResult.medicalCertStatus ? `
        <div class="section">
          <div class="section-header">
            <h3>Medical Certificate</h3>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div class="license-item">
              <label>Status</label>
              <div class="status-badge ${mvrResult.medicalCertStatus?.toLowerCase().includes('valid') || mvrResult.medicalCertStatus?.toLowerCase().includes('certified') ? 'status-valid' : 'status-pending'}">
                ${mvrResult.medicalCertStatus}
              </div>
            </div>
            <div class="license-item">
              <label>Expiration</label>
              <div class="value">${formatDate(mvrResult.medicalCertExpiration)}</div>
            </div>
          </div>
        </div>
        ` : ''}

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value ${(mvrResult.totalPoints || 0) === 0 ? 'good' : 'bad'}">${mvrResult.totalPoints || 0}</div>
            <div class="stat-label">Points</div>
          </div>
          <div class="stat-card">
            <div class="stat-value ${(mvrResult.violationCount || 0) === 0 ? 'good' : 'warning'}">${mvrResult.violationCount || 0}</div>
            <div class="stat-label">Violations</div>
          </div>
          <div class="stat-card">
            <div class="stat-value ${(mvrResult.accidentCount || 0) === 0 ? 'good' : 'bad'}">${mvrResult.accidentCount || 0}</div>
            <div class="stat-label">Accidents</div>
          </div>
          <div class="stat-card">
            <div class="stat-value ${(mvrResult.suspensionCount || 0) === 0 ? 'good' : 'bad'}">${mvrResult.suspensionCount || 0}</div>
            <div class="stat-label">Suspensions</div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h3>Violations</h3>
            ${mvrResult.violations?.length ? `<span class="section-count">${mvrResult.violations.length}</span>` : ''}
          </div>
          ${violationsHtml}
        </div>

        <div class="section">
          <div class="section-header">
            <h3>Accidents</h3>
            ${mvrResult.accidents?.length ? `<span class="section-count">${mvrResult.accidents.length}</span>` : ''}
          </div>
          ${accidentsHtml}
        </div>

        <div class="section">
          <div class="section-header">
            <h3>Suspensions</h3>
            ${mvrResult.suspensions?.length ? `<span class="section-count">${mvrResult.suspensions.length}</span>` : ''}
          </div>
          ${suspensionsHtml}
        </div>

        <div class="footer">
          <p>Report generated ${new Date().toLocaleString()}</p>
          <p>Data received ${new Date(mvrResult.receivedAt).toLocaleString()}</p>
          <p class="brand" style="margin-top: 8px;">StormChain - Blockchain-Verified Career Platform</p>
        </div>

        <script>
          // Auto-trigger print dialog
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  useEffect(() => {
    if (!isOpen || !walletAddress) {
      return
    }

    const fetchMvrData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/mvr/check-status?walletAddress=${encodeURIComponent(walletAddress)}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch MVR data')
        }

        const data = await response.json()

        if (data.payments && data.payments.length > 0) {
          setPayments(data.payments)
        }

        if (data.hasMvr && data.order) {
          setMvrOrder(data.order)

          if (data.result?.id) {
            const orderId = data.order.id
            const statusResponse = await fetch(`/api/mvr/status/${orderId}?walletAddress=${encodeURIComponent(walletAddress)}`)
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json()
              if (statusData.result) {
                setMvrResult(statusData.result)
              }
            }
          }
        } else {
          setError('No MVR found')
        }
      } catch (err: any) {
        console.error('Error fetching MVR data:', err)
        setError(err.message || 'Failed to load MVR data')
      } finally {
        setLoading(false)
      }
    }

    fetchMvrData()
  }, [isOpen, walletAddress])

  if (!isOpen) return null

  // Determine if we're in dark mode
  const isDark = theme === 'dark'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50' 
          : 'bg-white border border-gray-200'
      }`}>
        
        {/* Header with gradient accent */}
        <div className={`relative px-6 py-5 border-b ${
          isDark ? 'border-gray-700/50' : 'border-gray-200'
        }`}>
          {/* Accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-sage via-brand-mint to-brand-sage-light" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                isDark ? 'bg-brand-sage/20' : 'bg-brand-sage/10'
              }`}>
                <FileText className="h-6 w-6 text-brand-mint" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Motor Vehicle Report
                </h2>
                {/* Show driver name prominently if available */}
                {mvrResult && formatDriverName(mvrResult.subject) ? (
                  <p className={`text-sm font-medium ${isDark ? 'text-brand-mint' : 'text-brand-sage'}`}>
                    {formatDriverName(mvrResult.subject)}
                  </p>
                ) : (
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Official DMV Record
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Download/Print Button - only show when results are available */}
              {mvrResult && mvrOrder && (
                <button
                  onClick={handleDownloadPDF}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-medium text-sm ${
                    isDark 
                      ? 'bg-brand-sage/20 hover:bg-brand-sage/30 text-brand-mint' 
                      : 'bg-brand-sage/10 hover:bg-brand-sage/20 text-brand-sage'
                  }`}
                  title="Download or Print Report"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              )}
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-all ${
                  isDark 
                    ? 'hover:bg-gray-700/50 text-gray-400 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-500/20 rounded-full" />
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-indigo-500 rounded-full animate-spin" />
              </div>
              <p className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Loading MVR data...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`p-4 rounded-full ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <AlertCircle className="h-12 w-12 text-red-500" />
              </div>
              <p className={`mt-4 font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {error}
              </p>
            </div>
          ) : (
            <>
              {/* Payment History Accordion */}
              {payments.length > 0 && (
                <div className={`rounded-xl overflow-hidden ${
                  isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <button
                    onClick={() => setShowPayments(!showPayments)}
                    className={`w-full px-4 py-3 flex items-center justify-between ${
                      isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-100'
                    } transition-colors`}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className={`h-4 w-4 ${isDark ? 'text-brand-mint' : 'text-brand-sage'}`} />
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Payment History
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-brand-sage/20 text-brand-mint' : 'bg-brand-sage/10 text-brand-sage'
                      }`}>
                        {payments.length}
                      </span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${
                      showPayments ? 'rotate-180' : ''
                    } ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  </button>
                  
                  {showPayments && (
                    <div className={`px-4 pb-4 space-y-2 border-t ${
                      isDark ? 'border-gray-700/50' : 'border-gray-200'
                    }`}>
                      <div className="pt-3">
                        {payments.map((payment, idx) => (
                          <div
                            key={payment.id}
                            className={`p-3 rounded-lg ${
                              isDark ? 'bg-gray-900/50' : 'bg-white border border-gray-100'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                ${payment.amount} USDC
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                                payment.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  payment.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'
                                }`} />
                                {payment.status}
                              </span>
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {new Date(payment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Order Status Card */}
              {mvrOrder && (
                <div className={`rounded-xl p-5 ${
                  isDark 
                    ? 'bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700/50' 
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Order Number
                      </p>
                      <p className={`mt-1 font-mono text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {mvrOrder.orderNumber}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Status
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getStatusBadge(mvrOrder.status).dot}`} />
                        <span className={`text-sm font-medium ${getStatusBadge(mvrOrder.status).text}`}>
                          {mvrOrder.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Ordered
                      </p>
                      <p className={`mt-1 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatDate(mvrOrder.orderedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* MVR Results */}
              {mvrResult ? (
                <>
                  {/* License Card - Hero Section */}
                  <div className={`rounded-xl overflow-hidden ${
                    isDark 
                      ? 'bg-gradient-to-br from-brand-sage/20 via-gray-800 to-gray-800/50 border border-brand-sage/30' 
                      : 'bg-gradient-to-br from-brand-cream to-white border border-brand-sage/20'
                  }`}>
                    <div className={`px-5 py-4 border-b ${
                      isDark ? 'border-brand-sage/20' : 'border-brand-sage/10'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-brand-mint" />
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          License Information
                        </h3>
                      </div>
                    </div>
                    
                    <div className="p-5">
                      {/* Driver name from DMV record (when available) */}
                      {formatDriverName(mvrResult.subject) && (
                        <div className="mb-5">
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Name on record
                          </p>
                          <p className={`mt-1 text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {formatDriverName(mvrResult.subject)}
                          </p>
                        </div>
                      )}
                      {/* Main License Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            License Number
                          </p>
                          <p className={`mt-1 text-lg font-bold font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {mvrResult.licenseNumber || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            State
                          </p>
                          <p className={`mt-1 text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {mvrResult.licenseState || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Status
                          </p>
                          <div className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                            getStatusBadge(mvrResult.licenseStatus).bg
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(mvrResult.licenseStatus).dot}`} />
                            <span className={`text-sm font-semibold ${getStatusBadge(mvrResult.licenseStatus).text}`}>
                              {mvrResult.licenseStatus || 'Unknown'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Expiration
                          </p>
                          <p className={`mt-1 text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {formatDate(mvrResult.licenseExpirationDate)}
                          </p>
                        </div>
                      </div>

                      {/* License Classes */}
                      {mvrResult.licenses && mvrResult.licenses.length > 0 && (
                        <div className={`mt-6 pt-5 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                          <p className={`text-xs uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            License Classes
                          </p>
                          <div className="grid gap-3">
                            {mvrResult.licenses.map((license, idx) => (
                              <div 
                                key={idx}
                                className={`p-4 rounded-xl ${
                                  isDark ? 'bg-gray-900/50' : 'bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                      license.type?.toLowerCase().includes('commercial')
                                        ? 'bg-blue-500/20'
                                        : isDark ? 'bg-gray-700' : 'bg-gray-200'
                                    }`}>
                                      <span className={`text-xl font-black ${
                                        license.type?.toLowerCase().includes('commercial')
                                          ? 'text-blue-400'
                                          : isDark ? 'text-gray-300' : 'text-gray-600'
                                      }`}>
                                        {license.class || '?'}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                          Class {license.class}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                          license.type?.toLowerCase().includes('commercial')
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                          {license.type || 'Standard'}
                                        </span>
                                      </div>
                                      {license.classDescription && (
                                        <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                          {license.classDescription}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className={`px-2.5 py-1 rounded-lg ${getStatusBadge(license.status).bg}`}>
                                    <span className={`text-xs font-medium ${getStatusBadge(license.status).text}`}>
                                      {license.status || 'Unknown'}
                                    </span>
                                  </div>
                                </div>
                                {license.restrictions && (
                                  <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                      <span className="font-medium">Restrictions:</span> {license.restrictions}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Medical Certificate */}
                  {(mvrResult.medicalCertExpiration || mvrResult.medicalCertStatus) && (
                    <div className={`rounded-xl overflow-hidden ${
                      isDark 
                        ? 'bg-gray-800/50 border border-gray-700/50' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-5 w-5 text-emerald-400" />
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Medical Certificate
                          </h3>
                        </div>
                      </div>
                      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Status</p>
                          <div className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                            getStatusBadge(mvrResult.medicalCertStatus).bg
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(mvrResult.medicalCertStatus).dot}`} />
                            <span className={`text-sm font-semibold ${getStatusBadge(mvrResult.medicalCertStatus).text}`}>
                              {mvrResult.medicalCertStatus || 'Unknown'}
                            </span>
                          </div>
                        </div>
                        {mvrResult.medicalCertIssueDate && (
                          <div>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Issued</p>
                            <p className={`mt-1 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {formatDate(mvrResult.medicalCertIssueDate)}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Expiration</p>
                          <p className={`mt-1 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {formatDate(mvrResult.medicalCertExpiration)}
                          </p>
                        </div>
                        {mvrResult.medicalCertSelfCertification && (
                          <div>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Self Certification</p>
                            <p className={`mt-1 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {mvrResult.medicalCertSelfCertification}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-3">
                    {/* Points */}
                    <div className={`rounded-xl p-4 text-center ${
                      isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
                    }`}>
                      <div className={`text-3xl font-black ${
                        (mvrResult.totalPoints || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {mvrResult.totalPoints || 0}
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Points
                      </p>
                    </div>
                    
                    {/* Violations */}
                    <div className={`rounded-xl p-4 text-center ${
                      isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
                    }`}>
                      <div className={`text-3xl font-black ${
                        (mvrResult.violationCount || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {mvrResult.violationCount || 0}
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Violations
                      </p>
                    </div>
                    
                    {/* Accidents */}
                    <div className={`rounded-xl p-4 text-center ${
                      isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
                    }`}>
                      <div className={`text-3xl font-black ${
                        (mvrResult.accidentCount || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {mvrResult.accidentCount || 0}
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Accidents
                      </p>
                    </div>
                    
                    {/* Suspensions */}
                    <div className={`rounded-xl p-4 text-center ${
                      isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
                    }`}>
                      <div className={`text-3xl font-black ${
                        (mvrResult.suspensionCount || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {mvrResult.suspensionCount || 0}
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Suspensions
                      </p>
                    </div>
                  </div>

                  {/* Violations Detail */}
                  {mvrResult.violations && mvrResult.violations.length > 0 && (
                    <div className={`rounded-xl overflow-hidden ${
                      isDark 
                        ? 'bg-gray-800/50 border border-gray-700/50' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-400" />
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Violations
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400`}>
                            {mvrResult.violations.length}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        {mvrResult.violations.map((violation, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-xl border-l-4 border-amber-500 ${
                              isDark ? 'bg-amber-500/5' : 'bg-amber-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {violation.description || violation.type || 'Violation'}
                                </p>
                                <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm ${
                                  isDark ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  {violation.date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5" />
                                      Issue: {formatDate(violation.date)}
                                    </span>
                                  )}
                                  {violation.convictionDate && (
                                    <span className="flex items-center gap-1">
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Conviction: {formatDate(violation.convictionDate)}
                                    </span>
                                  )}
                                  {violation.state && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5" />
                                      {violation.state}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {violation.points !== undefined && violation.points > 0 && (
                                  <span className="text-lg font-bold text-red-400">
                                    {violation.points} pts
                                  </span>
                                )}
                                {violation.acdCode && (
                                  <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    ACD: {violation.acdCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accidents Detail */}
                  {mvrResult.accidents && mvrResult.accidents.length > 0 && (
                    <div className={`rounded-xl overflow-hidden ${
                      isDark 
                        ? 'bg-gray-800/50 border border-gray-700/50' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <Car className="h-5 w-5 text-red-400" />
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Accidents
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400`}>
                            {mvrResult.accidents.length}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        {mvrResult.accidents.map((accident, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-xl border-l-4 border-red-500 ${
                              isDark ? 'bg-red-500/5' : 'bg-red-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {accident.description || 'Accident'}
                                </p>
                                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {formatDate(accident.date)}
                                </p>
                              </div>
                              <div className="text-right">
                                {accident.severity && (
                                  <span className={`text-sm font-medium ${
                                    accident.severity.toLowerCase().includes('fatal') 
                                      ? 'text-red-400' 
                                      : 'text-amber-400'
                                  }`}>
                                    {accident.severity}
                                  </span>
                                )}
                                {accident.fault && (
                                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Fault: {accident.fault}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suspensions Detail */}
                  {mvrResult.suspensions && mvrResult.suspensions.length > 0 && (
                    <div className={`rounded-xl overflow-hidden ${
                      isDark 
                        ? 'bg-gray-800/50 border border-gray-700/50' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-400" />
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Suspensions
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400`}>
                            {mvrResult.suspensions.length}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        {mvrResult.suspensions.map((suspension, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-xl border-l-4 border-red-600 ${
                              isDark ? 'bg-red-500/5' : 'bg-red-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {suspension.reason || 'Suspension'}
                                </p>
                                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  From: {formatDate(suspension.date)}
                                  {suspension.endDate && ` → To: ${formatDate(suspension.endDate)}`}
                                </p>
                              </div>
                              {suspension.state && (
                                <span className={`text-sm flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  <MapPin className="h-3.5 w-3.5" />
                                  {suspension.state}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className={`text-center text-xs py-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    Report received {new Date(mvrResult.receivedAt).toLocaleString()}
                    {mvrResult.parsedAt && ` • Processed ${new Date(mvrResult.parsedAt).toLocaleString()}`}
                  </div>
                </>
              ) : (
                /* Processing State */
                <div className={`rounded-xl p-8 ${
                  isDark 
                    ? 'bg-amber-500/10 border border-amber-500/30' 
                    : 'bg-amber-50 border border-amber-200'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                      <Clock className="h-8 w-8 text-amber-500" />
                    </div>
                    <div>
                      <p className={`font-semibold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                        MVR Results Processing
                      </p>
                      <p className={`text-sm mt-1 ${isDark ? 'text-amber-500/80' : 'text-amber-600'}`}>
                        This typically takes a few minutes. The report will update automatically when ready.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
