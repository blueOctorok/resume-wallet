// lib/hash-utils.ts
// Local SHA-256 hash calculation for files (FREE operation)

export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

export async function calculateFileHashFromBuffer(
  buffer: ArrayBuffer
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

// Validate file before hash calculation
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    return {
      valid: false,
      error: 'File too large. Maximum 5MB.',
    }
  }

  // Check file type
  if (
    ![
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(file.type)
  ) {
    return {
      valid: false,
      error: 'Invalid file type. PDF or DOC only.',
    }
  }

  return { valid: true }
}
