/** Parse MM/YYYY or "Present" to YYYYMM so months compare as numbers. */
export function parseDateToNumber(dateStr: string): number | null {
  if (!dateStr) return null
  if (dateStr.toLowerCase() === 'present') {
    const now = new Date()
    return now.getFullYear() * 100 + (now.getMonth() + 1)
  }
  const match = dateStr.match(/^(\d{1,2})\/(\d{4})$/)
  if (match) {
    return parseInt(match[2], 10) * 100 + parseInt(match[1], 10)
  }
  return null
}
