'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { parseAamvaLicense } from '@/lib/aamva-license'

/**
 * Live camera read of the PDF417 on the back of a license.
 * Frames are decoded in the browser. Nothing is uploaded.
 */
export default function LicenseBarcodeScanner({
  onRead,
  onClose,
}: {
  onRead: (raw: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer = 0
    let decoding = false

    const stop = () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }

    const tick = async (
      readBarcodes: typeof import('zxing-wasm/reader').readBarcodes,
    ) => {
      if (stopped) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2 || decoding) {
        timer = window.setTimeout(() => void tick(readBarcodes), 250)
        return
      }

      decoding = true
      try {
        const image = frameFromVideo(video, canvas)
        const results = await readBarcodes(image, {
          formats: ['PDF417'],
          tryHarder: true,
          maxNumberOfSymbols: 1,
        })
        const text = results.map((result) => result.text?.trim() ?? '').find((value) => value.length > 0)
        if (text && parseAamvaLicense(text)) {
          stop()
          onRead(text)
          return
        }
      } catch (frameError) {
        console.warn('[LICENSE] frame decode failed:', frameError)
      } finally {
        decoding = false
      }
      if (!stopped) timer = window.setTimeout(() => void tick(readBarcodes), 400)
    }

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot open a camera. Use a phone or a computer with a camera.')
        return
      }
      const { prepareZXingModule, readBarcodes } = await import('zxing-wasm/reader')
      // The wasm file is served from /public so the camera page does not have to
      // guess where the bundler put it.
      prepareZXingModule({
        overrides: {
          locateFile: (path, prefix) => (path.endsWith('.wasm') ? '/zxing/zxing_reader.wasm' : prefix + path),
        },
      })
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      })
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setReady(true)
      timer = window.setTimeout(() => void tick(readBarcodes), 300)
    })().catch((cameraError: unknown) => {
      if (stopped) return
      const name = cameraError instanceof DOMException ? cameraError.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Allow the camera to scan the barcode. The picture is not saved.'
          : 'The camera did not open. Check that another app is not using it.',
      )
    })

    return stop
  }, [onRead])

  return (
    <Modal onClose={onClose} maxWidth='max-w-lg' panelShape='block' zIndex={1100}>
      <ModalHeader
        variant='block'
        title='Scan the barcode'
        subtitle='Hold the back of the license in the frame. The picture stays on this device.'
        onClose={onClose}
      />
      <div className='space-y-3 p-4'>
        <div className='relative overflow-hidden rounded-xl bg-[#173150]'>
          <video ref={videoRef} className='aspect-[4/3] w-full object-cover' playsInline muted autoPlay />
          <canvas ref={canvasRef} className='hidden' />
          <div className='pointer-events-none absolute inset-6 rounded-lg border-2 border-retro-teal shadow-[0_0_0_999px_rgba(23,49,80,0.35)]' />
        </div>
        {error ? (
          <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
        ) : (
          <p className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400'>
            {ready ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            {ready ? 'Looking for the barcode…' : 'Opening the camera…'}
          </p>
        )}
      </div>
    </Modal>
  )
}

function frameFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData {
  const maxEdge = 1600
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
  const width = Math.max(1, Math.round(video.videoWidth * scale))
  const height = Math.max(1, Math.round(video.videoHeight * scale))
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Could not read the camera frame')
  context.drawImage(video, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}
