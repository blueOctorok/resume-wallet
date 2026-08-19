'use client'

/**
 * Full-viewport dark canvas — same vocabulary as vault tile faces: dual-phase grid,
 * champagne/steel blooms over ink navy.
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
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            'radial-gradient(ellipse min(100%, 90vw) min(70%, 48rem) at 50% 8%, rgba(241,90,43,0.09) 0%, transparent 58%)',
        }}
      />
      <span
        aria-hidden
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_42%_at_96%_92%,rgba(95,122,158,0.1)_0%,transparent_52%)]'
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
