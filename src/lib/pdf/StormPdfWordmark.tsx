/**
 * PDF-native ZKNIGHT wordmark — mirrors the navbar `StormChainWordmark` (no vault
 * chrome): a violet-framed shield tile with a check mark + ZKNIGHT.
 *
 * Built with @react-pdf Svg/Text so server-side PDF generation needs no Chromium
 * or rasterized logo assets.
 */
import React from 'react'
import { Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'

// Duplicated from StormPdfChrome tokens — avoids a circular import (chrome → wordmark).
const INK = '#0f172a'
const MUTED = '#475569'
const TEAL = '#0d9488'

/** Lucide ShieldCheck paths (24×24 viewBox) — same icon as the web wordmark. */
const SHIELD_CHECK_PATHS = [
  'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  'm9 12 2 2 4-4',
] as const

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  letter: {
    fontFamily: 'Orbitron',
    fontWeight: 600,
    fontSize: 13,
    color: INK,
    letterSpacing: 1.1,
  },
  markTile: {
    width: 13,
    height: 13,
    marginRight: 3,
    borderWidth: 1.4,
    borderColor: '#7c3aed',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdfa',
  },
  tagline: {
    fontSize: 7.5,
    color: MUTED,
    marginTop: 2,
    letterSpacing: 0.3,
  },
})

export interface StormPdfWordmarkProps {
  /** Optional muted line under the mark (e.g. "Verified Career Identity"). */
  tagline?: string
}

function StormPdfShieldTile() {
  return (
    <View style={styles.markTile}>
      <Svg width={9} height={9} viewBox="0 0 24 24">
        {SHIELD_CHECK_PATHS.map((d) => (
          <Path
            key={d}
            d={d}
            stroke={TEAL}
            strokeWidth={2.15}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  )
}

export function StormPdfWordmark({ tagline }: StormPdfWordmarkProps) {
  return (
    <View>
      <View style={styles.row}>
        <StormPdfShieldTile />
        <Text style={styles.letter}>ZKNIGHT</Text>
      </View>
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>
  )
}
