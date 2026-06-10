/**
 * PDF-native STORM wordmark — mirrors the navbar `StormChainWordmark` (no vault
 * chrome): ST + violet-framed O tile with cloud-lightning + RM.
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

/** Lucide CloudLightning paths (24×24 viewBox) — same icon as the web wordmark. */
const CLOUD_LIGHTNING_PATHS = [
  'M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973',
  'm13 12-3 5h4l-3 5',
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
  oTile: {
    width: 13,
    height: 13,
    marginHorizontal: 1,
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

function StormPdfOTile() {
  return (
    <View style={styles.oTile}>
      <Svg width={9} height={9} viewBox="0 0 24 24">
        {CLOUD_LIGHTNING_PATHS.map((d) => (
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
        <Text style={styles.letter}>ST</Text>
        <StormPdfOTile />
        <Text style={styles.letter}>RM</Text>
      </View>
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>
  )
}
