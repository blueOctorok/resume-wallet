import { randomUUID } from 'crypto'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export type DocumentBucket = 'resumes' | 'dot-applications' | 'screening-reports'

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600

export function buildStorageObjectPath(userId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'
  return `${userId}/${randomUUID()}-${safeName}`
}

function toBuffer(file: File | Buffer | ArrayBuffer | Uint8Array): Buffer | Promise<Buffer> {
  if (Buffer.isBuffer(file)) return file
  if (file instanceof ArrayBuffer) return Buffer.from(file)
  if (file instanceof Uint8Array) return Buffer.from(file)
  if (typeof File !== 'undefined' && file instanceof File) {
    return file.arrayBuffer().then((ab) => Buffer.from(ab))
  }
  return Buffer.from(file as unknown as ArrayBuffer)
}

export async function uploadDocument(
  userId: string,
  bucket: DocumentBucket,
  file: File | Buffer | ArrayBuffer | Uint8Array,
  filename: string,
  contentType?: string,
): Promise<{ storagePath: string; bucket: DocumentBucket }> {
  const supabase = await getAdminSupabaseClient()
  const storagePath = buildStorageObjectPath(userId, filename)
  const body = await toBuffer(file)

  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    contentType: contentType || 'application/octet-stream',
    upsert: false,
  })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  return { storagePath, bucket }
}

export async function getSignedDocumentUrl(
  bucket: DocumentBucket,
  storagePath: string,
  expirySeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const supabase = await getAdminSupabaseClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expirySeconds)

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Failed to create signed URL')
  }

  return data.signedUrl
}

export async function deleteDocument(bucket: DocumentBucket, storagePath: string): Promise<void> {
  const supabase = await getAdminSupabaseClient()
  const { error } = await supabase.storage.from(bucket).remove([storagePath])
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`)
  }
}

export async function resolveResumeDocumentSignedUrl(
  resume: { storage_path?: string | null },
  expirySeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!resume.storage_path) return null
  return getSignedDocumentUrl('resumes', resume.storage_path, expirySeconds)
}

/** True when a resume row has a file in Supabase Storage (not a builder/upload placeholder). */
export function hasStoredResumeFile(record: {
  storage_path?: string | null
  ipfs_hash?: string | null
}): boolean {
  if (record.storage_path) return true
  return false
}
