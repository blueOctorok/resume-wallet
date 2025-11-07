/**
 * T Backend Setup Component
 * 
 * Admin interface to initialize T Backend with:
 * - Vector store for trucking knowledge
 * - Knowledge graph with trucking facts
 * - Optional document uploads
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { CheckCircle, XCircle, Loader2, Upload, Database, Brain, FileText, Plus, Trash2 } from 'lucide-react'

export default function TBackendSetup() {
  const { theme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [setupResults, setSetupResults] = useState<any>(null)
  const [documentUrl, setDocumentUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [showAuthOptions, setShowAuthOptions] = useState(false)
  const [authHeaders, setAuthHeaders] = useState('')
  const [authCookies, setAuthCookies] = useState('')
  const [bearerToken, setBearerToken] = useState('')
  const [basicAuthUsername, setBasicAuthUsername] = useState('')
  const [basicAuthPassword, setBasicAuthPassword] = useState('')

  const checkStatus = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/t-backend/admin/setup')
      const data = await response.json()

      if (data.success) {
        setStatus(data.status)
      } else {
        setError(data.error || 'Failed to get status')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check status')
    } finally {
      setIsLoading(false)
    }
  }

  const runSetup = async () => {
    setIsLoading(true)
    setError(null)
    setSetupResults(null)

    try {
      const response = await fetch('/api/t-backend/admin/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setupVectorStore: true,
          setupKnowledgeGraph: true,
          uploadSampleDocs: false,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSetupResults(data)
        // Refresh status
        await checkStatus()
        // Refresh file list
        await loadFiles()
      } else {
        setError(data.error || 'Setup failed')
        if (data.errors && data.errors.length > 0) {
          setError(data.errors.join('\n'))
        }
      }
    } catch (err: any) {
      setError(err.message || 'Setup failed')
    } finally {
      setIsLoading(false)
    }
  }

  const loadFiles = async () => {
    try {
      const response = await fetch('/api/t-backend/setup-vector-store')
      const data = await response.json()

      if (data.success && data.files) {
        setUploadedFiles(data.files)
      }
    } catch (err) {
      console.error('Failed to load files:', err)
    }
  }

  const uploadDocument = async () => {
    if (!documentUrl.trim()) {
      setError('Please enter a document URL')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Check if URL requires authentication
      const requiresAuth = showAuthOptions && (
        bearerToken.trim() ||
        (basicAuthUsername.trim() && basicAuthPassword.trim()) ||
        authHeaders.trim() ||
        authCookies.trim()
      )

      let response
      
      if (requiresAuth) {
        // Use authenticated upload endpoint
        const headers: Record<string, string> = {}
        const cookies: Record<string, string> = {}
        
        // Parse headers (format: "Header-Name: value")
        if (authHeaders.trim()) {
          authHeaders.split('\n').forEach((line) => {
            const [key, ...valueParts] = line.split(':')
            if (key && valueParts.length > 0) {
              headers[key.trim()] = valueParts.join(':').trim()
            }
          })
        }
        
        // Parse cookies (format: "name=value" or "name1=value1; name2=value2")
        if (authCookies.trim()) {
          authCookies.split(';').forEach((cookie) => {
            const [key, value] = cookie.split('=')
            if (key && value) {
              cookies[key.trim()] = value.trim()
            }
          })
        }
        
        response = await fetch('/api/t-backend/upload-authenticated', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: documentUrl.trim(),
            headers,
            cookies,
            bearerToken: bearerToken.trim() || undefined,
            username: basicAuthUsername.trim() || undefined,
            password: basicAuthPassword.trim() || undefined,
          }),
        })
      } else {
        // Use regular public URL upload
        response = await fetch('/api/t-backend/setup-vector-store', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'upload-files',
            fileUrls: [documentUrl.trim()],
          }),
        })
      }

      const data = await response.json()

      if (data.success) {
        setDocumentUrl('')
        setBearerToken('')
        setBasicAuthUsername('')
        setBasicAuthPassword('')
        setAuthHeaders('')
        setAuthCookies('')
        setShowAuthOptions(false)
        await loadFiles()
        await checkStatus()
        // Show success message
        setSetupResults({
          ...setupResults,
          uploadedFiles: data.uploadResults || [],
        })
      } else {
        setError(data.error || 'Failed to upload document')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  // Load files when component mounts
  useEffect(() => {
    loadFiles()
  }, [])

  return (
    <div
      className={`max-w-4xl mx-auto p-6 rounded-lg shadow-xl ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 backdrop-blur-xl border border-brand-mint'
          : 'bg-white/90 backdrop-blur-xl border border-gray-200'
      }`}
    >
      <div className="mb-6">
        <h2
          className={`text-2xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-brand-sage'
          }`}
        >
          T Backend Setup
        </h2>
        <p
          className={`text-sm ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Initialize T Backend with trucking knowledge vector store and knowledge graph.
          This makes T more directed and specific for driver employment applications.
        </p>
      </div>

      {/* Current Status */}
      <div className="mb-6">
        <button
          onClick={checkStatus}
          disabled={isLoading}
          className={`px-4 py-2 rounded-md font-medium transition-all ${
            theme === 'dark'
              ? 'bg-gray-700 text-white hover:bg-gray-600'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            'Check Status'
          )}
        </button>

        {status && (
          <div className="mt-4 space-y-3">
            {/* Vector Store Status */}
            <div
              className={`p-4 rounded-lg border-2 ${
                status.vectorStore
                  ? theme === 'dark'
                    ? 'bg-green-900/20 border-green-500/50'
                    : 'bg-green-50 border-green-200'
                  : status.vectorStoreError
                    ? theme === 'dark'
                      ? 'bg-yellow-900/20 border-yellow-500/50'
                      : 'bg-yellow-50 border-yellow-200'
                    : theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-600'
                      : 'bg-gray-50 border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database
                    className={`w-5 h-5 ${
                      status.vectorStore
                        ? theme === 'dark'
                          ? 'text-green-400'
                          : 'text-green-600'
                        : status.vectorStoreError
                          ? theme === 'dark'
                            ? 'text-yellow-400'
                            : 'text-yellow-600'
                          : theme === 'dark'
                            ? 'text-gray-400'
                            : 'text-gray-500'
                    }`}
                  />
                  <div>
                    <h3
                      className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Vector Store
                    </h3>
                    <p
                      className={`text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      {status.vectorStore
                        ? `${status.vectorStore.name} (${status.vectorStore.fileCount || 0} files)`
                        : status.vectorStoreError
                          ? status.vectorStoreError
                          : 'Not set up'}
                    </p>
                  </div>
                </div>
                {status.vectorStore ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : status.vectorStoreError ? (
                  <XCircle className="w-5 h-5 text-yellow-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Knowledge Graph Status */}
            <div
              className={`p-4 rounded-lg border-2 ${
                status.knowledgeGraph
                  ? theme === 'dark'
                    ? 'bg-green-900/20 border-green-500/50'
                    : 'bg-green-50 border-green-200'
                  : status.knowledgeGraphError
                    ? theme === 'dark'
                      ? 'bg-yellow-900/20 border-yellow-500/50'
                      : 'bg-yellow-50 border-yellow-200'
                    : theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-600'
                      : 'bg-gray-50 border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Brain
                    className={`w-5 h-5 ${
                      status.knowledgeGraph
                        ? theme === 'dark'
                          ? 'text-green-400'
                          : 'text-green-600'
                        : status.knowledgeGraphError
                          ? theme === 'dark'
                            ? 'text-yellow-400'
                            : 'text-yellow-600'
                          : theme === 'dark'
                            ? 'text-gray-400'
                            : 'text-gray-500'
                    }`}
                  />
                  <div>
                    <h3
                      className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Knowledge Graph
                    </h3>
                    <p
                      className={`text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      {status.knowledgeGraph
                        ? `${status.knowledgeGraph.factCount || 0} facts`
                        : status.knowledgeGraphError
                          ? status.knowledgeGraphError
                          : 'Not set up'}
                    </p>
                  </div>
                </div>
                {status.knowledgeGraph ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : status.knowledgeGraphError ? (
                  <XCircle className="w-5 h-5 text-yellow-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Setup Button */}
      <div className="mb-6">
        <button
          onClick={runSetup}
          disabled={isLoading}
          className={`w-full px-6 py-3 rounded-md font-semibold transition-all ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
              Setting up T Backend...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 inline mr-2" />
              Run Setup
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className={`p-4 rounded-lg border-2 ${
            theme === 'dark'
              ? 'bg-red-900/20 border-red-500/50'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              theme === 'dark' ? 'text-red-400' : 'text-red-800'
            }`}
          >
            {error}
          </p>
          {error.includes('502') || error.includes('Bad Gateway') ? (
            <div className={`mt-2 text-xs ${
              theme === 'dark' ? 'text-red-300' : 'text-red-700'
            }`}>
              <p>💡 <strong>This is a T Backend server issue.</strong></p>
              <p className="mt-1">
                The T Backend server appears to be down or experiencing issues. 
                Please try again in a few minutes or contact T Backend support.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Setup Results */}
      {setupResults && (
        <div
          className={`p-4 rounded-lg border-2 ${
            theme === 'dark'
              ? 'bg-green-900/20 border-green-500/50'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <h3
            className={`font-semibold mb-2 ${
              theme === 'dark' ? 'text-green-400' : 'text-green-800'
            }`}
          >
            Setup Complete!
          </h3>
          <div className="space-y-2 text-sm">
            {setupResults.vectorStore && (
              <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                ✅ Vector Store: {setupResults.vectorStore.name} (
                {setupResults.vectorStore.fileCount || 0} files)
              </p>
            )}
            {setupResults.knowledgeGraph && (
              <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                ✅ Knowledge Graph: {setupResults.knowledgeGraph.factCount || 0} facts
                added
              </p>
            )}
            {setupResults.errors && setupResults.errors.length > 0 && (
              <div className="mt-2">
                <p className={theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'}>
                  ⚠️ Some errors occurred:
                </p>
                <ul className="list-disc list-inside ml-2">
                  {setupResults.errors.map((err: string, i: number) => (
                    <li key={i} className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Upload Section */}
      {status?.vectorStore && (
        <div className="mt-6">
          <div className="mb-4">
            <h3
              className={`text-lg font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-brand-sage'
              }`}
            >
              Upload Documents
            </h3>
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Upload DOT regulations, CDL manuals, or other trucking documents by URL.
              T will automatically search these documents when answering questions.
            </p>
          </div>

          {/* Upload Form */}
          <div className="mb-4">
            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://example.com/dot-regulations.pdf"
                className={`flex-1 px-4 py-2 rounded-md border-2 focus:outline-none focus:ring-2 ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !uploading) {
                    uploadDocument()
                  }
                }}
              />
              <button
                onClick={uploadDocument}
                disabled={uploading || !documentUrl.trim()}
                className={`px-6 py-2 rounded-md font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                    : 'bg-brand-sage text-white hover:bg-brand-sage/90'
                } ${uploading || !documentUrl.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 inline mr-2" />
                    Upload
                  </>
                )}
              </button>
            </div>
            
            {/* Authentication Options Toggle */}
            <button
              type="button"
              onClick={() => setShowAuthOptions(!showAuthOptions)}
              className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`}
            >
              {showAuthOptions ? '▼' : '▶'} URL requires authentication/login?
            </button>
            
            {/* Authentication Options */}
            {showAuthOptions && (
              <div
                className={`p-4 rounded-lg border-2 mb-4 space-y-3 ${
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-600'
                    : 'bg-gray-50 border-gray-300'
                }`}
              >
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Bearer Token
                  </label>
                  <input
                    type="password"
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    placeholder="Bearer token"
                    className={`w-full px-3 py-2 rounded-md border-2 text-sm ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      className={`block text-sm font-medium mb-1 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Username (Basic Auth)
                    </label>
                    <input
                      type="text"
                      value={basicAuthUsername}
                      onChange={(e) => setBasicAuthUsername(e.target.value)}
                      placeholder="Username"
                      className={`w-full px-3 py-2 rounded-md border-2 text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label
                      className={`block text-sm font-medium mb-1 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Password (Basic Auth)
                    </label>
                    <input
                      type="password"
                      value={basicAuthPassword}
                      onChange={(e) => setBasicAuthPassword(e.target.value)}
                      placeholder="Password"
                      className={`w-full px-3 py-2 rounded-md border-2 text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
                
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Custom Headers (one per line, format: Header-Name: value)
                  </label>
                  <textarea
                    value={authHeaders}
                    onChange={(e) => setAuthHeaders(e.target.value)}
                    placeholder="Authorization: Bearer token&#10;X-API-Key: key"
                    rows={3}
                    className={`w-full px-3 py-2 rounded-md border-2 text-sm font-mono ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Cookies (format: name=value; name2=value2)
                  </label>
                  <input
                    type="text"
                    value={authCookies}
                    onChange={(e) => setAuthCookies(e.target.value)}
                    placeholder="session=abc123; auth=xyz789"
                    className={`w-full px-3 py-2 rounded-md border-2 text-sm ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="mt-4">
              <h4
                className={`text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Uploaded Documents ({uploadedFiles.length})
              </h4>
              <div className="space-y-2">
                {uploadedFiles.map((file: any, index: number) => (
                  <div
                    key={file.file_id || index}
                    className={`p-3 rounded-lg border-2 flex items-center justify-between ${
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <FileText
                        className={`w-5 h-5 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      />
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {file.filename || `File ${index + 1}`}
                        </p>
                        {file.file_id && (
                          <p
                            className={`text-xs ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            ID: {file.file_id}
                          </p>
                        )}
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Example URLs */}
          <div
            className={`mt-4 p-3 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-xs font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Example Documents to Upload:
            </p>
            <ul
              className={`text-xs space-y-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              <li>• DOT Regulations (49 CFR 391, 383)</li>
              <li>• State-specific CDL manuals</li>
              <li>• FMCSA guidance documents</li>
              <li>• Hours of Service regulations</li>
              <li>• Employer policies and procedures</li>
            </ul>
          </div>
        </div>
      )}

      {/* Info */}
      <div
        className={`mt-6 p-4 rounded-lg ${
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
        }`}
      >
        <p
          className={`text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          <strong>What this does:</strong> Creates a vector store for trucking documents
          and seeds a knowledge graph with DOT regulations, CDL requirements, and
          compliance facts. T will automatically use these when answering questions.
        </p>
      </div>
    </div>
  )
}

