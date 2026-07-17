/**
 * JSX for @vercel/og / next/og ImageResponse — inline styles only (Satori).
 * Variants: link preview 1200×630, social square 1200×1200, signature strip 600×150.
 */
import type { CareerCardSection, ProjectedCareerCard } from '@/types/career-card'

export type CareerCardOgVariant = 'link' | 'social' | 'signature'

const teal = '#14b8a6'
const bg = '#0f172a'
const muted = '#94a3b8'
const white = '#f8fafc'

/**
 * Satori (next/og) does not support conic-gradient — use a solid “donut” ring instead of a progress arc.
 */
function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score))
  return (
    <div
      style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: teal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 68,
          height: 68,
          borderRadius: 34,
          backgroundColor: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 800, color: white }}>{clamped}</span>
        <span style={{ fontSize: 10, color: muted, marginTop: -2 }}>score</span>
      </div>
    </div>
  )
}

function SectionPills({ labels }: { labels: string[] }) {
  const max = 6
  const slice = labels.slice(0, max)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {slice.map((label) => (
        <span
          key={label}
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: '#1e293b',
            color: muted,
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid #334155`,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

/** Word-wrap long copy into Satori-friendly line chunks (no CSS text-wrap reliance). */
function chunkLines(text: string, maxLen: number, maxLines: number): string[] {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return []
  const out: string[] = []
  let rest = t
  while (rest.length > 0 && out.length < maxLines) {
    if (rest.length <= maxLen) {
      out.push(rest)
      break
    }
    let cut = rest.lastIndexOf(' ', maxLen)
    if (cut < 32) cut = maxLen
    out.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  return out
}

function sectionToOgLine(s: CareerCardSection): string | null {
  switch (s.blockType) {
    case 'storm-resume':
    case 'driver-resume':
    case 'developer-resume':
    case 'general-resume': {
      const d = s.data as import('@/types/career-card').ResumeData
      const st = d.verificationStatus ? ` · ${d.verificationStatus}` : ''
      return d.title ? `${s.label}: ${d.title}${st}` : `${s.label} on card`
    }
    case 'developer-github': {
      const d = s.data as import('@/types/career-card').GitHubData
      const u = d.username ? `@${d.username}` : 'GitHub'
      const bits = [`${s.label}: ${u}`]
      if (d.publicRepos != null) bits.push(`${d.publicRepos} repos`)
      if (d.followers != null) bits.push(`${d.followers} followers`)
      let line = bits.join(' · ')
      if (d.bio?.trim()) {
        const bio = d.bio.trim().slice(0, 140)
        line += ` — ${bio}${d.bio.trim().length > 140 ? '…' : ''}`
      }
      return line
    }
    case 'developer-projects': {
      const titles = (s.data as import('@/types/career-card').ProjectsData).projects.map((p) => p.title).filter(Boolean).slice(0, 4)
      return titles.length ? `${s.label}: ${titles.join(' · ')}` : null
    }
    case 'developer-portfolio': {
      const raw = (s.data as import('@/types/career-card').PortfolioData).portfolioUrl
      const u = raw?.replace(/^https?:\/\//i, '').replace(/\/$/, '')
      return u ? `${s.label}: ${u.slice(0, 96)}${u.length > 96 ? '…' : ''}` : null
    }
    case 'driver-cdl-credentials': {
      const d = s.data as import('@/types/career-card').CdlData
      const bits = [d.cdlClass, d.cdlState].filter(Boolean).join(' · ')
      return bits ? `${s.label}: ${bits}` : null
    }
    case 'driver-mvr': {
      const d = s.data as import('@/types/career-card').MvrData
      if (d.results) {
        return `${s.label}: ${d.results.licenseClass} · ${d.results.licenseStatus} · ${d.licenseState}`
      }
      return `${s.label}: ${d.orderStatus} · ${d.licenseState}`
    }
    case 'driver-psp': {
      const d = s.data as import('@/types/career-card').PspData
      if (d.resultSummary?.resultStatus) {
        return `${s.label}: ${d.resultSummary.resultStatus} · ${d.licenseState}`
      }
      return `${s.label}: ${d.orderStatus} · ${d.licenseState}`
    }
    case 'driver-dot-application': {
      const d = s.data as import('@/types/career-card').DotAppData
      return `${s.label}: ${d.status}${d.isComplete ? ' · complete' : ''}`
    }
    case 'driver-screening-consent': {
      const d = s.data as import('@/types/career-card').ScreeningConsentData
      const n = d.bundles.length
      return n ? `${s.label}: ${n} employer package(s)` : `${s.label} on card`
    }
    default:
      return `${s.label} on card`
  }
}

/** Rich text lines for OG / social images — fills the “card body” instead of an empty flex gap. */
function buildOgBodyLines(card: ProjectedCareerCard, isSocial: boolean): string[] {
  const maxLines = isSocial ? 16 : 7
  const lineBudget = isSocial ? 110 : 92
  const lines: string[] = []

  const summary = card.professionalSummary?.trim()
  if (summary && summary.length > 0) {
    const chunks = chunkLines(summary, lineBudget, isSocial ? 5 : 3)
    lines.push(...chunks)
  }

  for (const s of card.sections) {
    if (lines.length >= maxLines) break
    const line = sectionToOgLine(s)
    if (line) {
      for (const part of chunkLines(line, lineBudget, 2)) {
        if (lines.length >= maxLines) break
        lines.push(part)
      }
    }
  }

  for (const c of card.onChainCredentials) {
    if (lines.length >= maxLines) break
    lines.push(`Verified: ${c.label}`)
  }
  for (const e of card.employerConfirmations) {
    if (lines.length >= maxLines) break
    lines.push(`Employer confirmed: ${e.companyName} — ${e.position}`)
  }

  return lines.slice(0, maxLines)
}

function OgBodyPanel({
  lines,
  isSocial,
}: {
  lines: string[]
  isSocial: boolean
}) {
  const fontSize = isSocial ? 19 : 15
  const pad = isSocial ? 28 : 20
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        minHeight: 0,
        padding: pad,
        backgroundColor: '#1e293b',
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#334155',
        gap: isSocial ? 10 : 8,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', letterSpacing: 3, textTransform: 'uppercase' }}>
        Career highlights
      </span>
      {lines.map((line, i) => (
        <span
          key={i}
          style={{
            fontSize,
            color: '#e2e8f0',
            lineHeight: 1.4,
            fontWeight: 400,
          }}
        >
          {line}
        </span>
      ))}
    </div>
  )
}

export function buildCareerCardOgElement(
  card: ProjectedCareerCard,
  variant: CareerCardOgVariant,
  opts: { avatarDataUrl?: string | null },
) {
  const sectionLabels = card.sections.map((s) => s.label)
  const employerConfirmed = card.employerConfirmedEmploymentCount
  // Issuer-backed / verified credential count for signature strip (never invent)
  const verifiedCount = card.onChainCredentials?.length ?? 0
  const headline =
    card.occupation ||
    card.professionalSummary?.slice(0, 120) ||
    'Verified by ZKnight career card'

  if (variant === 'signature') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: `linear-gradient(135deg, ${bg} 0%, #1e293b 100%)`,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {opts.avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori img in OG pipeline
            <img
              src={opts.avatarDataUrl}
              width={56}
              height={56}
              alt=""
              style={{ borderRadius: 28, objectFit: 'cover', border: `2px solid ${teal}` }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: white,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {card.name
                .split(/\s+/)
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: white }}>{card.name}</span>
            <span style={{ fontSize: 14, color: muted, maxWidth: 360 }}>{headline}</span>
            <span style={{ fontSize: 12, color: teal, fontWeight: 600 }}>
              {verifiedCount > 0
                ? `${verifiedCount} verified credential${verifiedCount === 1 ? '' : 's'} · ZKnight Career Card`
                : 'ZKnight Career Card'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ScoreRing score={card.careerCardScore} />
          <span style={{ fontSize: 11, color: muted, fontWeight: 700, letterSpacing: 2 }}>ZKNIGHT</span>
        </div>
      </div>
    )
  }

  const isSocial = variant === 'social'
  const width = isSocial ? 1200 : 1200
  const height = isSocial ? 1200 : 630

  const bodyLinesRaw = buildOgBodyLines(card, isSocial)
  const bodyLines =
    bodyLinesRaw.length > 0
      ? bodyLinesRaw
      : [
          'Open your full ZKnight Career Card for verified credentials, resume, GitHub, portfolio, and more — everything in one shareable link.',
        ]

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        padding: isSocial ? 56 : 40,
        background: `linear-gradient(145deg, ${bg} 0%, #1e293b 55%, #0f172a 100%)`,
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 24, alignItems: 'center' }}>
          {opts.avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={opts.avatarDataUrl}
              width={isSocial ? 120 : 96}
              height={isSocial ? 120 : 96}
              alt=""
              style={{
                borderRadius: isSocial ? 60 : 48,
                objectFit: 'cover',
                border: `3px solid ${teal}`,
              }}
            />
          ) : (
            <div
              style={{
                width: isSocial ? 120 : 96,
                height: isSocial ? 120 : 96,
                borderRadius: isSocial ? 60 : 48,
                background: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: white,
                fontSize: isSocial ? 36 : 28,
                fontWeight: 800,
                border: `3px solid ${teal}`,
              }}
            >
              {card.name
                .split(/\s+/)
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: isSocial ? 720 : 640 }}>
            <span style={{ fontSize: isSocial ? 44 : 36, fontWeight: 900, color: white, lineHeight: 1.1 }}>
              {card.name}
            </span>
            <span style={{ fontSize: isSocial ? 22 : 18, color: muted, lineHeight: 1.35 }}>{headline}</span>
            {card.location ? (
              <span style={{ fontSize: 15, color: '#64748b' }}>{card.location}</span>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: `${teal}22`,
                  color: teal,
                  fontSize: 14,
                  fontWeight: 700,
                  border: `1px solid ${teal}55`,
                }}
              >
                {employerConfirmed > 0
                  ? `${employerConfirmed} employer confirmation${employerConfirmed === 1 ? '' : 's'}`
                  : `${card.sections.length} block${card.sections.length === 1 ? '' : 's'} on card`}
              </span>
              {card.employerConfirmedEmploymentCount > 0 ? (
                <span
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: '#312e81',
                    color: '#a5b4fc',
                    fontSize: 14,
                    fontWeight: 700,
                    border: '1px solid #4c1d95',
                  }}
                >
                  {card.employerConfirmedEmploymentCount} employer confirmation
                  {card.employerConfirmedEmploymentCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <ScoreRing score={card.careerCardScore} />
      </div>

      <div
        style={{
          marginTop: isSocial ? 28 : 22,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: isSocial ? 22 : 16,
          minHeight: 0,
        }}
      >
        <OgBodyPanel lines={bodyLines} isSocial={isSocial} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: 3, textTransform: 'uppercase' }}>
            Blocks on card
          </span>
          <SectionPills labels={sectionLabels.length ? sectionLabels : ['Build your card on ZKnight']} />
        </div>
      </div>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: isSocial ? 22 : 18,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #334155',
        }}
      >
        <span style={{ fontSize: 14, color: muted, fontWeight: 600 }}>
          zknight.io · Verified by ZKnight Career Card
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: teal, letterSpacing: 4 }}>ZKNIGHT</span>
      </div>
    </div>
  )
}

/** Fetch avatar as data URL for Satori (remote URLs are unreliable in OG without this). */
export async function tryAvatarDataUrl(avatarUrl: string | null): Promise<string | null> {
  if (!avatarUrl || !/^https?:\/\//i.test(avatarUrl)) return null
  try {
    const res = await fetch(avatarUrl, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ct = res.headers.get('content-type') ?? 'image/jpeg'
    if (!ct.startsWith('image/')) return null
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
    const base64 = btoa(binary)
    return `data:${ct};base64,${base64}`
  } catch {
    return null
  }
}
