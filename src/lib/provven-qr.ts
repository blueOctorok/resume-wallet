/**
 * Branded QR — midnight modules + Hot Embers Provven mark in the center,
 * matching the Blue Star brand presentation (white pad, high error correction).
 *
 * Logo overlay needs errorCorrectionLevel 'H' so scanners still read through
 * the center. Canvas compositing is browser-only; Node callers get a plain QR.
 */

export const PROVVEN_QR_DARK = '#173150'
export const PROVVEN_QR_LIGHT = '#ffffff'
export const PROVVEN_MARK_SRC = '/brand/provven-mark.svg'

export const PROVVEN_QR_OPTS = {
  margin: 1,
  color: { dark: PROVVEN_QR_DARK, light: PROVVEN_QR_LIGHT },
  errorCorrectionLevel: 'H' as const,
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
  ctx.fill()
}

/** Stamp the embers mark + white pad onto an existing QR canvas. */
export async function stampProvvenMarkOnCanvas(
  canvas: HTMLCanvasElement,
  markSrc = PROVVEN_MARK_SRC,
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const size = canvas.width
  const logo = Math.round(size * 0.24)
  const pad = Math.round(size * 0.045)
  const box = logo + pad * 2
  const x = (size - box) / 2
  const y = (size - box) / 2

  ctx.fillStyle = PROVVEN_QR_LIGHT
  fillRoundRect(ctx, x, y, box, box, Math.max(2, Math.round(pad * 0.55)))

  const img = await loadImage(markSrc)
  ctx.drawImage(img, x + pad, y + pad, logo, logo)
}

export async function qrDataUrlWithProvvenMark(
  text: string,
  size: number,
): Promise<string> {
  const QRCode = (await import('qrcode')).default
  const qr = await QRCode.toDataURL(text, { ...PROVVEN_QR_OPTS, width: size })

  if (typeof document === 'undefined') return qr

  try {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return qr

    const qrImg = await loadImage(qr)
    ctx.drawImage(qrImg, 0, 0, size, size)
    await stampProvvenMarkOnCanvas(canvas)
    return canvas.toDataURL('image/png')
  } catch {
    return qr
  }
}
