'use strict'

/**
 * Stub implementation for `pino-pretty`.
 *
 * WalletConnect's logger pulls in `pino`, which tries to resolve the optional
 * pretty-print transport at build time. This placeholder keeps the Next.js
 * bundle happy without shipping the dev-only dependency.
 */
export default function createPinoPretty() {
  return {
    write() {
      // no-op
    },
  }
}


