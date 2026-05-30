'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { Eye, Trash2, Loader2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import type { AdminTabProps, PspRow } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

interface PspDetail {
  order: Record<string, unknown>
  results: Array<Record<string, unknown>>
}

export default function PspTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [pspOrders, setPspOrders] = useState<PspRow[]>([])
  const [selectedDetail, setSelectedDetail] = useState<PspDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showXml, setShowXml] = useState<'none' | 'order' | 'result'>('none')

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/psp?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } },
      )
      const data = await res.json()
      if (data.success) {
        setPspOrders(data.pspOrders || [])
        setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch PSP orders:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchDetail = useCallback(
    async (orderId: string) => {
      if (!walletAddress) return
      setLoadingDetail(true)
      setSelectedDetail(null)
      setShowXml('none')
      try {
        const res = await fetch(`/api/admin/psp/${orderId}`, {
          headers: { 'x-wallet-address': walletAddress },
        })
        const data = await res.json()
        if (data.success) {
          setSelectedDetail({ order: data.order, results: data.results || [] })
        }
      } catch (err) {
        console.error('Failed to fetch PSP detail:', err)
      } finally {
        setLoadingDetail(false)
      }
    },
    [walletAddress],
  )

  return (
    <>
      <div className='overflow-x-auto'>
        <table className='w-full'>
          <thead className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}>
            <tr>
              <th className={`${tableHeaderClass} px-4 py-3`}>Candidate</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Ordered By</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>DL State</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Result</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Accio #</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Ordered</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
            {pspOrders.map(psp => (
              <tr
                key={psp.id}
                className={isDarkTheme(theme) ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}
              >
                <td className={tableCellClass}>
                  <div>
                    <div>{psp.driverName}</div>
                    <code className='text-xs opacity-75'>
                      {psp.walletAddress.slice(0, 8)}...{psp.walletAddress.slice(-4)}
                    </code>
                  </div>
                </td>
                <td className={tableCellClass}>
                  {psp.orderedBy.type === 'self' ? (
                    <span className='inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'>
                      Self-order
                    </span>
                  ) : (
                    <span
                      className='inline-flex items-center px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                      title={`Company ID: ${psp.orderedBy.companyId}`}
                    >
                      {psp.orderedBy.companyName ?? 'Employer'}
                    </span>
                  )}
                </td>
                <td className={tableCellClass}>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      psp.status === 'completed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : psp.status === 'pending' || psp.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {psp.status || '-'}
                  </span>
                </td>
                <td className={tableCellClass}>{psp.dlState || '-'}</td>
                <td className={tableCellClass}>
                  {psp.resultStatus ? (
                    <span className='text-xs'>{psp.resultStatus}</span>
                  ) : (
                    <span className='text-xs opacity-50'>—</span>
                  )}
                </td>
                <td className={tableCellClass}>
                  <code className='text-xs'>{psp.accioOrderNumber || '-'}</code>
                </td>
                <td className={tableCellClass}>
                  {psp.orderedAt
                    ? new Date(psp.orderedAt).toLocaleDateString()
                    : new Date(psp.createdAt).toLocaleDateString()}
                </td>
                <td className={tableCellClass}>
                  <div className='flex items-center gap-1'>
                    <button
                      onClick={() => fetchDetail(psp.id)}
                      className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400'
                      title='View PSP data'
                    >
                      <Eye className='w-4 h-4' />
                    </button>
                    <button
                      onClick={() =>
                        onDelete({
                          type: 'psp',
                          id: psp.id,
                          name: `PSP ${psp.dlState || 'order'} (${psp.driverName})`,
                        })
                      }
                      className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                      title='Remove PSP order and results'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pspOrders.length === 0 && (
          <div className='text-center py-12 text-gray-500'>No PSP orders found</div>
        )}
      </div>

      {/* PSP Detail Modal */}
      {(selectedDetail || loadingDetail) && (
        <Modal onClose={() => setSelectedDetail(null)} maxWidth='max-w-4xl'>
          {loadingDetail ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='w-8 h-8 animate-spin text-indigo-400' />
            </div>
          ) : (
            selectedDetail && (
              <>
                <ModalHeader title='PSP Order Details' onClose={() => setSelectedDetail(null)} />
                <div className='p-4 space-y-6'>
                  {/* Order info */}
                  <div>
                    <h4
                      className={`font-medium mb-2 ${
                        isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-700'
                      }`}
                    >
                      Order
                    </h4>
                    <div
                      className={`p-4 rounded-lg text-sm grid grid-cols-2 md:grid-cols-3 gap-2 ${
                        isDarkTheme(theme) ? 'bg-gray-700/50' : 'bg-gray-50'
                      }`}
                    >
                      <div>
                        <span className='opacity-70'>Driver:</span>{' '}
                        {String(selectedDetail.order.driverName || selectedDetail.order.walletAddress || '-')}
                      </div>
                      <div>
                        <span className='opacity-70'>Wallet:</span>{' '}
                        <code className='text-xs'>{String(selectedDetail.order.walletAddress || '-')}</code>
                      </div>
                      <div>
                        <span className='opacity-70'>Status:</span> {String(selectedDetail.order.status)}
                      </div>
                      <div>
                        <span className='opacity-70'>DL State:</span> {String(selectedDetail.order.dlState)}
                      </div>
                      <div>
                        <span className='opacity-70'>Accio #:</span>{' '}
                        {String(selectedDetail.order.accioOrderNumber || '-')}
                      </div>
                      <div>
                        <span className='opacity-70'>Sub #:</span>{' '}
                        {String(selectedDetail.order.accioSuborderNumber || '-')}
                      </div>
                      <div className='col-span-full'>
                        <span className='opacity-70'>Ordered by:</span>{' '}
                        {(() => {
                          const ob = selectedDetail.order.orderedBy as
                            | { type: 'self' }
                            | { type: 'employer'; companyName: string | null; companyId: string }
                            | undefined
                          if (!ob) return '-'
                          if (ob.type === 'self') return 'Candidate self-order'
                          return `${ob.companyName || 'Employer'} (CRA-isolated)`
                        })()}
                      </div>
                      <div>
                        <span className='opacity-70'>Ordered:</span>{' '}
                        {selectedDetail.order.orderedAt
                          ? new Date(selectedDetail.order.orderedAt as string).toLocaleString()
                          : '-'}
                      </div>
                      <div>
                        <span className='opacity-70'>Completed:</span>{' '}
                        {selectedDetail.order.completedAt
                          ? new Date(selectedDetail.order.completedAt as string).toLocaleString()
                          : '-'}
                      </div>
                      <div>
                        <span className='opacity-70'>Expires:</span>{' '}
                        {selectedDetail.order.expiresAt
                          ? new Date(selectedDetail.order.expiresAt as string).toLocaleDateString()
                          : '-'}
                      </div>
                      {Boolean(selectedDetail.order.errorMessage) && (
                        <div className='col-span-full text-red-500'>
                          <span className='opacity-70'>Error:</span>{' '}
                          {String(selectedDetail.order.errorMessage)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Results */}
                  {selectedDetail.results.length === 0 ? (
                    <p
                      className={`text-sm ${
                        isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      No results yet.
                    </p>
                  ) : (
                    selectedDetail.results.map((res, idx) => (
                      <div key={idx}>
                        <h4
                          className={`font-medium mb-2 ${
                            isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-700'
                          }`}
                        >
                          Result {selectedDetail.results.length > 1 ? idx + 1 : ''}
                        </h4>
                        <div
                          className={`p-4 rounded-lg text-sm space-y-3 ${
                            isDarkTheme(theme) ? 'bg-gray-700/50' : 'bg-gray-50'
                          }`}
                        >
                          <div className='grid grid-cols-2 md:grid-cols-3 gap-2'>
                            <div>
                              <span className='opacity-70'>Result status:</span>{' '}
                              {String(res.resultStatus ?? '-')}
                            </div>
                            <div>
                              <span className='opacity-70'>Received:</span>{' '}
                              {res.receivedAt
                                ? new Date(res.receivedAt as string).toLocaleString()
                                : '-'}
                            </div>
                            <div>
                              <span className='opacity-70'>Parsed:</span>{' '}
                              {res.parsedAt
                                ? new Date(res.parsedAt as string).toLocaleString()
                                : '-'}
                            </div>
                          </div>
                          {Boolean(res.parsedData) && (
                            <div>
                              <span className='opacity-70'>Parsed data:</span>
                              <pre
                                className={`mt-1 p-2 rounded text-xs overflow-x-auto max-h-64 ${
                                  isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-100'
                                }`}
                              >
                                {JSON.stringify(res.parsedData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Raw XML toggles */}
                  {(Boolean(selectedDetail.order.orderXml) ||
                    Boolean(selectedDetail.order.resultXml)) && (
                    <div>
                      <h4
                        className={`font-medium mb-2 ${
                          isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-700'
                        }`}
                      >
                        Raw XML
                      </h4>
                      <div className='flex gap-2 mb-2'>
                        {Boolean(selectedDetail.order.orderXml) && (
                          <button
                            onClick={() =>
                              setShowXml(showXml === 'order' ? 'none' : 'order')
                            }
                            className={`px-3 py-1.5 rounded text-sm ${
                              showXml === 'order'
                                ? 'bg-teal-600 text-white'
                                : isDarkTheme(theme)
                                  ? 'bg-gray-700'
                                  : 'bg-gray-200'
                            }`}
                          >
                            Order XML
                          </button>
                        )}
                        {Boolean(selectedDetail.order.resultXml) && (
                          <button
                            onClick={() =>
                              setShowXml(showXml === 'result' ? 'none' : 'result')
                            }
                            className={`px-3 py-1.5 rounded text-sm ${
                              showXml === 'result'
                                ? 'bg-teal-600 text-white'
                                : isDarkTheme(theme)
                                  ? 'bg-gray-700'
                                  : 'bg-gray-200'
                            }`}
                          >
                            Result XML
                          </button>
                        )}
                      </div>
                      {showXml === 'order' && Boolean(selectedDetail.order.orderXml) && (
                        <pre
                          className={`p-3 rounded text-xs overflow-x-auto max-h-64 whitespace-pre-wrap ${
                            isDarkTheme(theme) ? 'bg-gray-900' : 'bg-gray-100'
                          }`}
                        >
                          {String(selectedDetail.order.orderXml)}
                        </pre>
                      )}
                      {showXml === 'result' && Boolean(selectedDetail.order.resultXml) && (
                        <pre
                          className={`p-3 rounded text-xs overflow-x-auto max-h-64 whitespace-pre-wrap ${
                            isDarkTheme(theme) ? 'bg-gray-900' : 'bg-gray-100'
                          }`}
                        >
                          {String(selectedDetail.order.resultXml)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </Modal>
      )}
    </>
  )
}
