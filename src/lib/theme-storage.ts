/**
 * Persisted appearance:
 * - `light` — cream parchment & gold
 * - `dark` — ink navy & champagne gold (the seal)
 *
 * Schema v5: `paper` / `ink` removed (map to `light` / `dark`).
 * Older removed themes `sepia` / `business` still map to `light`.
 */
export type StoredTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'stormchain-theme'
export const THEME_SCHEMA_KEY = 'stormchain-theme-schema'
export const THEME_SCHEMA_VERSION = '5'

export function isStoredTheme(v: string | null): v is StoredTheme {
  return v === 'light' || v === 'dark'
}

/** True when Tailwind `dark:` and storm “dark chrome” paths should apply. */
export function isDarkTheme(theme: string): boolean {
  return theme === 'dark'
}

/** Retired theme names → nearest surviving appearance. */
function migrateStoredTheme(saved: string | null): StoredTheme | null {
  if (saved === 'paper' || saved === 'sepia' || saved === 'business') return 'light'
  if (saved === 'ink') return 'dark'
  return isStoredTheme(saved) ? saved : null
}

/** Run on load (and in root layout inline script) before paint to avoid flash. */
export function parseStoredTheme(): StoredTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    const theme = migrateStoredTheme(saved) ?? 'light'
    persistThemeToStorage(theme)
    return theme
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
