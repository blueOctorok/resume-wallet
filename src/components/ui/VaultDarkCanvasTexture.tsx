'use client'

/**
 * Full-viewport dark canvas — dual-phase grid over ink navy. No bloom.
 */
export default function VaultDarkCanvasTexture() {
  return (
    <>
      <span
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-[0.28] bg-[radial-gradient(rgba(255,255,255,0.052)_1px,transparent_1.5px)] [background-size:8px_8px]'
      />
      <span
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-[0.18] bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1.5px)] [background-size:8px_8px] [background-position:4px_4px]'
      />
      <span
        aria-hidden
        className='pointer-events-none absolute inset-0 mix-blend-soft-light opacity-[0.22]'
        style={{
          backgroundImage:
            'repeating-linear-gradient(178deg, transparent 0px, transparent 5px, rgba(255,255,255,0.028) 5px, rgba(255,255,255,0.028) 6px)',
        }}
      />
      <span
        aria-hidden
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_110%_90%_at_50%_50%,transparent_20%,rgba(0,0,0,0.42)_100%)] opacity-50 mix-blend-multiply'
      />
      <span
        aria-hidden
        className='pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent'
      />
    </>
  )
}
