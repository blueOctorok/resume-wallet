/**
 * PostgREST `.in(col, uuid[])` encodes every id into the query string.
 * Past ~100–200 UUIDs the request fails/returns empty — silent data loss.
 * Chunk every large `.in()` through this helper.
 */

export const SUPABASE_IN_CHUNK = 80

export async function fetchAllInChunks<T>(
  ids: string[],
  label: string,
  fetchChunk: (
    chunk: string[],
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  if (ids.length === 0) return []
  const out: T[] = []
  for (let i = 0; i < ids.length; i += SUPABASE_IN_CHUNK) {
    const chunk = ids.slice(i, i + SUPABASE_IN_CHUNK)
    const { data, error } = await fetchChunk(chunk)
    if (error) {
      console.error(`[IN CHUNKS] ${label}:`, error.message)
      continue
    }
    if (data?.length) out.push(...data)
  }
  return out
}
