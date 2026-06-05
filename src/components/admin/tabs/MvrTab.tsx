'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { Eye, Trash2, Loader2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import type { AdminTabProps, MvrRow } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

interface MvrDetail {
  order: Record<string, unknown>
  results: Array<Record<string, unknown>>
}

export default function MvrTab({
  theme,
  sessionUserId,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [mvrOrders, setMvrOrders] = useState<MvrRow[]>([])
  const [selectedMvrDetail, setSelectedMvrDetail] = useState<MvrDetail | null>(null)
  const [loadingMvrDetail, setLoadingMvrDetail] = useState(false)
  const [mvrDetailShowXml, setMvrDetailShowXml] = useState<'none' | 'order' | 'result'>('none')

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!sessionUserId) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/mvr?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': sessionUserId } }
      )
      const data = await res.json()
      if (data.success) {
        setMvrOrders(data.mvrOrders || [])
        setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch MVR orders:', err)
    }
  }, [sessionUserId, searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchMvrDetail = useCallback(
    async (orderId: string) => {
      if (!sessionUserId) return
      setLoadingMvrDetail(true)
      setSelectedMvrDetail(null)
      setMvrDetailShowXml('none')
      try {
        const res = await fetch(`/api/admin/mvr/${orderId}`, {
          headers: { 'x-wallet-address': sessionUserId },
        })
        const data = await res.json()
        if (data.success) {
          setSelectedMvrDetail({ order: data.order, results: data.results || [] })
        }
      } catch (err) {
        console.error('Failed to fetch MVR detail:', err)
      } finally {
        setLoadingMvrDetail(false)
      }
    },
    [sessionUserId]
  )

  return (
    <>
      <div className='overflow-x-auto'>
        <table className='w-full'>
          <thead
            className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}
          >
            <tr>
              <th className={`${tableHeaderClass} px-4 py-3`}>Candidate</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Ordered By</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>DL State</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>License Status</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Points</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Violations</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Ordered</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
            {mvrOrders.map((mvr) => (
              <tr
                key={mvr.id}
                className={
                  isDarkTheme(theme)
                    ? 'hover:bg-gray-800/50'
                    : 'hover:bg-gray-50'
                }
              >
                <td className={tableCellClass}>
                  <div>
                    <div>{mvr.driverName}</div>
                    <code className='text-xs opacity-75'>
                      {mvr.sessionUserId.slice(0, 8)}...{mvr.sessionUserId.slice(-4)}
                    </code>
                  </div>
                </td>
                <td className={tableCellClass}>
                  {mvr.orderedBy.type === 'self' ? (
                    <span className='inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'>
                      Self-order
                    </span>
                  ) : (
                    <span
                      className='inline-flex items-center px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                      title={`Company ID: ${mvr.orderedBy.companyId}`}
                    >
                      {mvr.orderedBy.companyName ?? 'Employer'}
                    </span>
                  )}
                </td>
                <td className={tableCellClass}>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      mvr.status === 'completed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : mvr.status === 'pending' || mvr.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {mvr.status || '-'}
                  </span>
                </td>
                <td className={tableCellClass}>
                  {mvr.dlState || '-'}
                </td>
                <td className={tableCellClass}>
                  {mvr.licenseStatus ? (
                    <span className='text-xs'>{mvr.licenseStatus}</span>
                  ) : (
                    <span className='text-xs opacity-50'>-</span>
                  )}
                </td>
                <td className={tableCellClass}>
                  {mvr.totalPoints != null ? mvr.totalPoints : '-'}
                </td>
                <td className={tableCellClass}>
                  {mvr.violationCount != null ? mvr.violationCount : '-'}
                </td>
                <td className={tableCellClass}>
                  {mvr.orderedAt
                    ? new Date(mvr.orderedAt).toLocaleDateString()
                    : new Date(mvr.createdAt).toLocaleDateString()}
                </td>
                <td className={tableCellClass}>
                  <div className='flex items-center gap-1'>
                    <button
                      onClick={() => fetchMvrDetail(mvr.id)}
                      className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400'
                      title='View MVR data'
                    >
                      <Eye className='w-4 h-4' />
                    </button>
                    <button
                      onClick={() =>
                        onDelete({
                          type: 'mvr',
                          id: mvr.id,
                          name: `MVR ${mvr.dlState || 'order'} (${mvr.driverName})`,
                        })
                      }
                      className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                      title='Remove MVR order and results'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {mvrOrders.length === 0 && (
          <div className='text-center py-12 text-gray-500'>
            No MVR orders found
          </div>
        )}
      </div>

      {/* MVR Detail Modal */}
      {(selectedMvrDetail || loadingMvrDetail) && (
        <Modal onClose={() => setSelectedMvrDetail(null)} maxWidth="max-w-4xl">
            {loadingMvrDetail ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 animate-spin text-indigo-400' />
              </div>
            ) : selectedMvrDetail && (
              <>
                <ModalHeader title="MVR Order Details" onClose={() => setSelectedMvrDetail(null)} />
                <div className='p-4 space-y-6'>
                  {/* Order info */}
                  <div>
                    <h4 className={`font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-700'}`}>Order</h4>
                    <div className={`p-4 rounded-lg text-sm grid grid-cols-2 md:grid-cols-3 gap-2 ${isDarkTheme(theme) ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <div><span className='opacity-70'>Driver:</span> {String(selectedMvrDetail.order.driverName || selectedMvrDetail.order.sessionUserId || '-')}</div>
                      <div><span className='opacity-70'>Wallet:</span> <code className='text-xs'>{String(selectedMvrDetail.order.sessionUserId || '-')}</code></div>
                      <div><span className='opacity-70'>Status:</span> {String(selectedMvrDetail.order.status)}</div>
                      <div><span className='opacity-70'>DL State:</span> {String(selectedMvrDetail.order.dlState)}</div>
                      <div><span className='opacity-70'>Accio #:</span> {String(selectedMvrDetail.order.accioOrderNumber || '-')}</div>
                      <div><span className='opacity-70'>Ordered:</span> {selectedMvrDetail.order.orderedAt ? new Date(selectedMvrDetail.order.orderedAt as string).toLocaleString() : '-'}</div>
                      <div><span className='opacity-70'>Completed:</span> {selectedMvrDetail.order.completedAt ? new Date(selectedMvrDetail.order.completedAt as string).toLocaleString() : '-'}</div>
                      <div><span className='opacity-70'>Expires:</span> {selectedMvrDetail.order.expiresAt ? new Date(selectedMvrDetail.order.expiresAt as string).toLocaleDateString() : '-'}</div>
                      <div><span className='opacity-70'>Fee:</span> {selectedMvrDetail.order.feeAmount != null ? `${selectedMvrDetail.order.feeAmount} ${selectedMvrDetail.order.feeCurrency || 'USD'}` : '-'}</div>
                      {selectedMvrDetail.order.errorMessage && (
                        <div className='col-span-full text-red-500'><span className='opacity-70'>Error:</span> {String(selectedMvrDetail.order.errorMessage)}</div>
                      )}
                    </div>
                  </div>

                  {/* Results */}
                  {selectedMvrDetail.results.length === 0 ? (
                    <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>No results yet.</p>
                  ) : (
                    selectedMvrDetail.results.map((res, idx) => (
                      <div key={idx}>
                        <h4 className={`font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-700'}`}>
                          Result {selectedMvrDetail.results.length > 1 ? idx + 1 : ''}
                        </h4>
                        <div className={`p-4 rounded-lg text-sm space-y-3 ${isDarkTheme(theme) ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                          <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
                            <div><span className='opacity-70'>License status:</span> {String(res.licenseStatus ?? '-')}</div>
                            <div><span className='opacity-70'>Class:</span> {String(res.licenseClass ?? '-')}</div>
                            <div><span className='opacity-70'>State:</span> {String(res.licenseState ?? '-')}</div>
                            <div><span className='opacity-70'>Expiration:</span> {res.licenseExpirationDate ? new Date(res.licenseExpirationDate as string).toLocaleDateString() : '-'}</div>
                            <div><span className='opacity-70'>Total points:</span> {res.totalPoints != null ? res.totalPoints : '-'}</div>
                            <div><span className='opacity-70'>Violations:</span> {res.violationCount != null ? res.violationCount : '-'}</div>
                            <div><span className='opacity-70'>Accidents:</span> {res.accidentCount != null ? res.accidentCount : '-'}</div>
                            <div><span className='opacity-70'>Suspensions:</span> {res.suspensionCount != null ? res.suspensionCount : '-'}</div>
                          </div>
                          {Array.isArray(res.cdlEndorsements) && (res.cdlEndorsements as string[]).length > 0 && (
                            <div><span className='opacity-70'>CDL Endorsements:</span> {(res.cdlEndorsements as string[]).join(', ')}</div>
                          )}
                          {Array.isArray(res.cdlRestrictions) && (res.cdlRestrictions as string[]).length > 0 && (
                            <div><span className='opacity-70'>CDL Restrictions:</span> {(res.cdlRestrictions as string[]).join(', ')}</div>
                          )}
                          {Array.isArray(res.violations) && (res.violations as unknown[]).length > 0 && (
                            <div>
                              <span className='opacity-70'>Violations detail:</span>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto max-h-40 ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                {JSON.stringify(res.violations, null, 2)}
                              </pre>
                            </div>
                          )}
                          {Array.isArray(res.accidents) && (res.accidents as unknown[]).length > 0 && (
                            <div>
                              <span className='opacity-70'>Accidents:</span>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto max-h-32 ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                {JSON.stringify(res.accidents, null, 2)}
                              </pre>
                            </div>
                          )}
                          {Array.isArray(res.suspensions) && (res.suspensions as unknown[]).length > 0 && (
                            <div>
                              <span className='opacity-70'>Suspensions:</span>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto max-h-32 ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                {JSON.stringify(res.suspensions, null, 2)}
                              </pre>
                            </div>
                          )}
                          {res.parsedData && (
                            <div>
                              <span className='opacity-70'>Parsed data (full):</span>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto max-h-48 ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                {JSON.stringify(res.parsedData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Raw XML (collapsible) */}
                  {(selectedMvrDetail.order.orderXml || selectedMvrDetail.order.resultXml) && (
                    <div>
                      <h4 className={`font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-700'}`}>Raw XML</h4>
                      <div className='flex gap-2 mb-2'>
                        {selectedMvrDetail.order.orderXml && (
                          <button
                            onClick={() => setMvrDetailShowXml(mvrDetailShowXml === 'order' ? 'none' : 'order')}
                            className={`px-3 py-1.5 rounded text-sm ${mvrDetailShowXml === 'order' ? 'bg-teal-600 text-white' : isDarkTheme(theme) ? 'bg-gray-700' : 'bg-gray-200'}`}
                          >
                            Order XML
                          </button>
                        )}
                        {selectedMvrDetail.order.resultXml && (
                          <button
                            onClick={() => setMvrDetailShowXml(mvrDetailShowXml === 'result' ? 'none' : 'result')}
                            className={`px-3 py-1.5 rounded text-sm ${mvrDetailShowXml === 'result' ? 'bg-teal-600 text-white' : isDarkTheme(theme) ? 'bg-gray-700' : 'bg-gray-200'}`}
                          >
                            Result XML
                          </button>
                        )}
                      </div>
                      {mvrDetailShowXml === 'order' && selectedMvrDetail.order.orderXml && (
                        <pre className={`p-3 rounded text-xs overflow-x-auto max-h-64 whitespace-pre-wrap ${isDarkTheme(theme) ? 'bg-gray-900' : 'bg-gray-100'}`}>
                          {String(selectedMvrDetail.order.orderXml)}
                        </pre>
                      )}
                      {mvrDetailShowXml === 'result' && selectedMvrDetail.order.resultXml && (
                        <pre className={`p-3 rounded text-xs overflow-x-auto max-h-64 whitespace-pre-wrap ${isDarkTheme(theme) ? 'bg-gray-900' : 'bg-gray-100'}`}>
                          {String(selectedMvrDetail.order.resultXml)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
        </Modal>
      )}
    </>
  )
}
