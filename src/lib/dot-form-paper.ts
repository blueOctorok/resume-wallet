/**
 * DOT forms are a legal packet. They stay cream paper + midnight ink even when
 * the app theme is Dark — same rule as the career card / DQ vault.
 */

/** Always false so existing `isDarkTheme(theme)` ternaries take the paper branch. */
export function isDotFormDark(_theme?: string): false {
  return false
}

export const DOT_PAPER_CARD =
  'rounded-2xl border border-ironside/30 bg-[#fbf8f1] text-[#173150] shadow-[0_24px_70px_-18px_rgba(0,0,0,0.18)] [color-scheme:light]'

export const DOT_PAPER_SECTION =
  'rounded-xl border border-ironside/25 bg-white p-6 text-[#173150]'

export const DOT_PAPER_LABEL = 'text-[#173150]'

export const DOT_PAPER_INPUT =
  'bg-white border-stone-300 text-[#173150] placeholder:text-ironside rounded-lg focus:outline-none focus:ring-2 focus:ring-[#173150]/25 focus:border-[#173150]'

export const DOT_PAPER_LOCKED =
  'bg-stone-100 cursor-not-allowed opacity-90 text-[#173150]'
