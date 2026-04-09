/**
 * Persisted appearance: `light` (icy), `sepia` (Kindle-style cream), `paper` (grey newsprint), `dark`.
 *
 * Schema v2: historically `paper` meant sepia. On first read after upgrade, migrate that value to `sepia`
 * so the id `paper` can mean the new neutral newspaper theme.
 */
export type StoredTheme = 'light' | 'dark' | 'sepia' | 'paper'

export const THEME_STORAGE_KEY = 'stormchain-theme'
export const THEME_SCHEMA_KEY = 'stormchain-theme-schema'
export const THEME_SCHEMA_VERSION = '2'
export const LIGHT_APPEARANCE_KEY = 'stormchain-light-appearance'

export function isStoredTheme(v: string | null): v is StoredTheme {
  return v === 'light' || v === 'dark' || v === 'sepia' || v === 'paper'
}

/** Run on load (and in root layout inline script) before paint to avoid flash. */
export function parseStoredTheme(): StoredTheme {
  try {
    const schema = localStorage.getItem(THEME_SCHEMA_KEY)
    const saved = localStorage.getItem(THEME_STORAGE_KEY)

    if (schema !== THEME_SCHEMA_VERSION) {
      if (saved === 'paper') {
        localStorage.setItem(THEME_SCHEMA_KEY, THEME_SCHEMA_VERSION)
        localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
        return 'sepia'
      }
      if (saved === 'light' || saved === 'dark') {
        localStorage.setItem(THEME_SCHEMA_KEY, THEME_SCHEMA_VERSION)
        return saved
      }
      localStorage.setItem(THEME_SCHEMA_KEY, THEME_SCHEMA_VERSION)
      return 'light'
    }

    if (isStoredTheme(saved)) return saved
  } catch {
    /* ignore */
  }
  return 'light'
}

export function persistThemeToStorage(theme: StoredTheme): void {
  try {
    localStorage.setItem(THEME_SCHEMA_KEY, THEME_SCHEMA_VERSION)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}
