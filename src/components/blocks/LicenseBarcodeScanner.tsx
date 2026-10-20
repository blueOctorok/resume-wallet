'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { parseAamvaLicense } from '@/lib/aamva-license'
import type { ReaderOptions, ReadResult } from 'zxing-wasm/reader'

/**
 * Live camera read of the PDF417 on the back of a license.
 * Frames are decoded in the browser. Nothing is uploaded.
 *
 * The slot on screen is the only region we decode. A full-frame photo makes
 * the bars too small, and zxing's default downscale pass erases a PDF417.
 */
const GUIDE = { x: 0.06, y: 0.34, width: 0.88, height: 0.32 }

const READER_OPTIONS: ReaderOptions = {
  formats: ['PDF417'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: false,
  tryDenoise: true,
  textMode: 'Plain',
  maxNumberOfSymbols: 1,
}

export default function LicenseBarcodeScanner({
  onRead,
  onClose,
}: {
  onRead: (raw: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let stopped = false
    let stream: MediaStream | null = null
    let timer = 0
    let decoding = false
    const canvas = document.createElement('canvas')

    const stop = () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }

    const tick = async (
      readBarcodes: typeof import('zxing-wasm/reader').readBarcodes,
    ) => {
      if (stopped) return
      if (video.readyState < 2 || !video.videoWidth || decoding) {
        timer = window.setTimeout(() => void tick(readBarcodes), 200)
        return
      }

      const image = captureGuide(video, canvas)
      if (!image || looksBlank(image)) {
        timer = window.setTimeout(() => void tick(readBarcodes), 200)
        return
      }

      decoding = true
      try {
        const results = await readBarcodes(image, READER_OPTIONS)
        const raw = licenseText(results)
        if (raw) {
          stop()
          onRead(raw)
          return
        }
      } catch (frameError) {
        const message = frameError instanceof Error ? frameError.message : ''
        console.warn('[LICENSE] frame decode failed:', frameError)
        if (/wasm|fetch|allocate|module/i.test(message)) {
          setError('The barcode reader did not start. Refresh the page and try again.')
          stop()
          return
        }
      } finally {
        decoding = false
      }
      if (!stopped) timer = window.setTimeout(() => void tick(readBarcodes), 280)
    }

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot open a camera. Use a phone or a computer with a camera.')
        return
      }
      const { prepareZXingModule, readBarcodes } = await import('zxing-wasm/reader')
      prepareZXingModule({
        overrides: {
          locateFile: (path, prefix) => (path.endsWith('.wasm') ? '/zxing/zxing_reader.wasm' : prefix + path),
        },
        fireImmediately: true,
      })
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      await preferContinuousFocus(stream)
      video.srcObject = stream
      await video.play()
      if (video.videoWidth === 0) {
        await new Promise<void>((resolve) => {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true })
        })
      }
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
        subtitle='Line up the block of tiny bars on the back. Not the solid black stripe. The picture stays on this device.'
        onClose={onClose}
      />
      <div className='space-y-3 p-4'>
        <div className='relative overflow-hidden rounded-xl bg-[#173150]'>
          <video ref={videoRef} className='aspect-[4/3] w-full object-cover' playsInline muted autoPlay />
          <div
            className='pointer-events-none absolute left-[6%] top-[34%] h-[32%] w-[88%] rounded-lg border-2 border-retro-teal shadow-[0_0_0_999px_rgba(23,49,80,0.45)]'
          />
        </div>
        {error ? (
          <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
        ) : (
          <p className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400'>
            {ready ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            {ready ? 'Hold the barcode steady in the slot…' : 'Opening the camera…'}
          </p>
        )}
      </div>
    </Modal>
  )
}

function licenseText(results: ReadResult[]): string | null {
  for (const result of results) {
    if (!result.isValid && !result.text && !result.bytes?.length) continue
    const plain = result.text?.trim() ?? ''
    if (plain && parseAamvaLicense(plain)) return plain
    if (result.bytes?.length) {
      const latin1 = new TextDecoder('iso-8859-1').decode(result.bytes).trim()
      if (latin1 && parseAamvaLicense(latin1)) return latin1
    }
  }
  return null
}

function captureGuide(video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null {
  const box = video.getBoundingClientRect()
  if (!box.width || !box.height || !video.videoWidth || !video.videoHeight) return null

  // object-cover shows the center of the camera. Map the slot back onto those pixels.
  const videoAspect = video.videoWidth / video.videoHeight
  const boxAspect = box.width / box.height
  let sx = 0
  let sy = 0
  let sw = video.videoWidth
  let sh = video.videoHeight
  if (videoAspect > boxAspect) {
    sw = video.videoHeight * boxAspect
    sx = (video.videoWidth - sw) / 2
  } else {
    sh = video.videoWidth / boxAspect
    sy = (video.videoHeight - sh) / 2
  }

  const srcX = sx + box.width * GUIDE.x * (sw / box.width)
  const srcY = sy + box.height * GUIDE.y * (sh / box.height)
  const srcW = box.width * GUIDE.width * (sw / box.width)
  const srcH = box.height * GUIDE.height * (sh / box.height)
  const zoom = srcW < 900 ? 2 : 1
  canvas.width = Math.max(1, Math.round(srcW * zoom))
  canvas.height = Math.max(1, Math.round(srcH * zoom))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.imageSmoothingEnabled = false
  context.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

function looksBlank(image: ImageData): boolean {
  const data = image.data
  const stride = Math.max(16, Math.floor(data.length / 160)) & ~3
  let sum = 0
  let count = 0
  for (let i = 0; i < data.length; i += stride) {
    sum += data[i] + data[i + 1] + data[i + 2]
    count += 1
  }
  return count > 0 && sum / count < 18
}

async function preferContinuousFocus(stream: MediaStream) {
  const track = stream.getVideoTracks()[0]
  const caps = track?.getCapabilities?.() as { focusMode?: string[] } | undefined
  if (!caps?.focusMode?.includes('continuous')) return
  await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined)
}
