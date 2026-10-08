import { readBarcodes } from 'zxing-wasm/reader'

/**
 * Read the PDF417 barcode on the back of a US license photo.
 * Returns the raw AAMVA string, or null when the photo is too soft or too glossy.
 */
export async function decodePdf417(bytes: Uint8Array, mimeType: string): Promise<string | null> {
  const blob = new Blob([bytes], { type: mimeType || 'image/jpeg' })
  const results = await readBarcodes(blob, {
    formats: ['PDF417'],
    tryHarder: true,
    maxNumberOfSymbols: 1,
  })
  const text = results.map((result) => result.text?.trim() ?? '').find((value) => value.length > 0)
  return text ?? null
}
