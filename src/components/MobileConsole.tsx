'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Mobile Console Viewer
 * 
 * Allows viewing console logs directly on mobile devices
 * Toggle with triple-tap on the logo or a button
 */
export default function MobileConsole() {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<Array<{ type: string; message: string; timestamp: Date }>>([])
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only enable on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (!isMobile) return

    // Intercept console methods
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn
    const originalInfo = console.info

    const addLog = (type: string, ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      
      setLogs(prev => [...prev.slice(-99), { // Keep last 100 logs
        type,
        message,
        timestamp: new Date()
      }])
    }

    console.log = (...args: any[]) => {
      originalLog(...args)
      addLog('log', ...args)
    }

    console.error = (...args: any[]) => {
      originalError(...args)
      addLog('error', ...args)
    }

    console.warn = (...args: any[]) => {
      originalWarn(...args)
      addLog('warn', ...args)
    }

    console.info = (...args: any[]) => {
      originalInfo(...args)
      addLog('info', ...args)
    }

    return () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
      console.info = originalInfo
    }
  }, [])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current && isOpen) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isOpen])

  // Only show on mobile
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (!isMobile) return null

  return (
    <>
      {/* Toggle Button - Fixed position */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 z-50 bg-gray-800 text-white px-3 py-2 rounded-lg text-xs font-mono shadow-lg"
        style={{ touchAction: 'manipulation' }}
      >
        {isOpen ? '📱 Hide' : '📱 Console'}
      </button>

      {/* Console Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 text-white p-4" style={{ paddingTop: '60px' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Mobile Console</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setLogs([])}
                className="px-3 py-1 bg-red-600 rounded text-sm"
                style={{ touchAction: 'manipulation' }}
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 bg-gray-600 rounded text-sm"
                style={{ touchAction: 'manipulation' }}
              >
                Close
              </button>
            </div>
          </div>

          <div
            ref={logContainerRef}
            className="bg-gray-900 rounded p-3 font-mono text-xs overflow-y-auto"
            style={{
              height: 'calc(100vh - 120px)',
              maxHeight: 'calc(100vh - 120px)',
            }}
          >
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`mb-1 pb-1 border-b border-gray-700 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'warn' ? 'text-yellow-400' :
                    log.type === 'info' ? 'text-blue-400' :
                    'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500 text-xs">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="ml-2 text-gray-400">[{log.type}]</span>
                  <div className="mt-1 whitespace-pre-wrap break-words">
                    {log.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}

