/**
 * Job rows Stormi can attach to a chat turn (external listings + match metadata).
 * Safe to import from client for rendering apply + external links.
 */

export interface StormiJobSuggestion {
  id: string
  title: string
  company: string
  location: string
  score: number
  reason: string
  redirectUrl: string | null
  salary: string | null
}
