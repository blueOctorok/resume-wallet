import type { DriverResumePacket } from '@/lib/driver-resume-packet'

/** Client-only: download premium DOT-packet PDF */
export async function downloadDriverResumePacketPdf(
  packet: DriverResumePacket,
  filenameBase: string,
): Promise<void> {
  const { generateDriverResumePacketPDF } = await import('@/lib/driver-resume-packet-pdf')
  const buf = await generateDriverResumePacketPDF(packet)
  const blob = new Blob([new Uint8Array(buf)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase.replace(/[^\w\s-]/g, '').slice(0, 60) || 'DOT-packet'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
