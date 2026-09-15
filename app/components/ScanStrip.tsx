'use client'

import { useRef, useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import ZoomableImage from '@/app/components/ZoomableImage'
import {
  STRIP_PARAMS,
  pinsForBrand,
  stripLayoutForBrand,
  CYA_STRIP_BANDS,
  whiteBalance,
  matchSwatch,
  type StripParamKey,
  type RGB,
} from '@/lib/stripScan'

type Step = 'intro' | 'camera' | 'review' | 'unclear'

// Below this average confidence across all sampled pads, the sample points
// are more likely landing on the wrong spots entirely (reversed strip,
// diagonal placement, wrong zoom) than just genuinely ambiguous colors —
// worth a retake prompt instead of confidently showing garbage numbers.
const RETAKE_CONFIDENCE_THRESHOLD = 0.25

// Guide rectangle as fractions of the camera container element.
// The strip must fill this thin horizontal band before the user taps Capture.
// Cropping to this region before analysis eliminates background interference
// (concrete, pool deck, etc.) that caused low-confidence scans in the wild.
const GUIDE = { x: 0.05, y: 0.36, w: 0.90, h: 0.28 }

interface ResultRow { value: number; confidence: number; rgb: RGB }

function averageColor(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): RGB {
  const canvas = ctx.canvas
  const x0 = Math.max(0, Math.round(cx - radius))
  const y0 = Math.max(0, Math.round(cy - radius))
  const x1 = Math.min(canvas.width, Math.round(cx + radius))
  const y1 = Math.min(canvas.height, Math.round(cy + radius))
  const w = Math.max(1, x1 - x0)
  const h = Math.max(1, y1 - y0)
  const data = ctx.getImageData(x0, y0, w, h).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++ }
  return [r / n, g / n, b / n]
}

function samplePixel(ctx: CanvasRenderingContext2D, x: number, y: number): RGB {
  const canvas = ctx.canvas
  const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x)))
  const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y)))
  const d = ctx.getImageData(px, py, 1, 1).data
  return [d[0], d[1], d[2]]
}

function findBestPin(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  key: StripParamKey,
  nominal: { x: number; y: number },
  whiteRgb: RGB
): { cx: number; cy: number } {
  const xRadius = 0.05
  const yRadius = 0.07
  const step = 0.01
  let best = { cx: nominal.x, cy: nominal.y, score: -Infinity }
  for (let dy = -yRadius; dy <= yRadius + 1e-9; dy += step) {
    for (let dx = -xRadius; dx <= xRadius + 1e-9; dx += step) {
      const fx = nominal.x + dx
      const fy = nominal.y + dy
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) continue
      const raw = samplePixel(ctx, fx * imgW, fy * imgH)
      const corrected = whiteBalance(raw, whiteRgb)
      const { confidence } = matchSwatch(key, corrected)
      if (confidence > best.score) best = { cx: fx, cy: fy, score: confidence }
    }
  }
  return best
}

function findStripRow(ctx: CanvasRenderingContext2D, imgW: number, imgH: number): number {
  let bestY = 0.5, bestRun = 0
  for (let yf = 0.08; yf <= 0.92; yf += 0.01) {
    const y = Math.round(yf * imgH)
    let run = 0, maxRun = 0
    for (let xf = 0; xf <= 1; xf += 0.004) {
      const x = Math.round(xf * imgW)
      const [r, g, b] = samplePixel(ctx, x, y)
      const lo = Math.min(r, g, b)
      const hi = Math.max(r, g, b)
      if (lo > 195 || hi - lo > 45) { run++; if (run > maxRun) maxRun = run } else { run = 0 }
    }
    if (maxRun > bestRun) { bestRun = maxRun; bestY = yf }
  }
  return bestY
}

interface PadBlob { xCenter: number; y: number }

function findPadBlobs(ctx: CanvasRenderingContext2D, imgW: number, imgH: number, coarseY: number): PadBlob[] {
  const step = 0.003
  const yBand = 0.05
  const cols: { sat: number; y: number }[] = []
  for (let xf = 0; xf <= 1; xf += step) {
    const x = Math.round(xf * imgW)
    let bestSat = 0, bestY = coarseY
    for (let dy = -yBand; dy <= yBand + 1e-9; dy += 0.005) {
      const yf = coarseY + dy
      if (yf < 0 || yf > 1) continue
      const y = Math.round(yf * imgH)
      const [r, g, b] = samplePixel(ctx, x, y)
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      if (sat > bestSat) { bestSat = sat; bestY = yf }
    }
    cols.push({ sat: bestSat, y: bestY })
  }

  const rawRuns: [number, number][] = []
  let runStart = -1
  for (let i = 0; i < cols.length; i++) {
    if (cols[i].sat > 35 && runStart < 0) runStart = i
    if (cols[i].sat <= 35 && runStart >= 0) {
      if ((i - runStart) * step > 0.015) rawRuns.push([runStart, i])
      runStart = -1
    }
  }
  if (runStart >= 0) rawRuns.push([runStart, cols.length - 1])

  const avgSatOf = (a: number, b: number) => {
    let sum = 0, n = 0
    for (let i = a; i <= b; i++) { sum += cols[i].sat; n++ }
    return sum / n
  }
  const padWidthCols = Math.max(1, Math.round(0.035 / step))
  const blobs: PadBlob[] = []
  for (const [rs, re] of rawRuns) {
    if ((re - rs) * step <= 0.07) {
      const c = Math.round((rs + re) / 2)
      blobs.push({ xCenter: (rs + re) / 2 * step, y: cols[c].y })
      continue
    }
    let bestStart = rs, bestAvg = -1
    for (let s = rs; s + padWidthCols <= re; s++) {
      const avg = avgSatOf(s, s + padWidthCols)
      if (avg > bestAvg) { bestAvg = avg; bestStart = s }
    }
    const bestEnd = bestStart + padWidthCols
    const c = Math.round((bestStart + bestEnd) / 2)
    blobs.push({ xCenter: (bestStart + bestEnd) / 2 * step, y: cols[c].y })
  }
  return blobs
}

function matchBlobsToPins(
  blobs: PadBlob[],
  pins: Record<StripParamKey, { x: number; y: number }>,
  keys: StripParamKey[]
): Partial<Record<StripParamKey, PadBlob>> {
  const maxDist = 0.12
  const candidates: { key: StripParamKey; blobIdx: number; dist: number }[] = []
  for (const key of keys) {
    blobs.forEach((b, i) => candidates.push({ key, blobIdx: i, dist: Math.abs(b.xCenter - pins[key].x) }))
  }
  candidates.sort((a, b) => a.dist - b.dist)
  const assigned: Partial<Record<StripParamKey, PadBlob>> = {}
  const usedBlobs = new Set<number>()
  for (const c of candidates) {
    if (c.dist > maxDist) break
    if (assigned[c.key] || usedBlobs.has(c.blobIdx)) continue
    assigned[c.key] = blobs[c.blobIdx]
    usedBlobs.add(c.blobIdx)
  }
  return assigned
}

// White reference has no swatch list to score against, so instead of
// matching a param it prefers whichever nearby point is brightest and least
// saturated (most neutral) — that's what the strip's own blank plastic
// looks like, versus colored pads or the (usually darker, textured)
// background behind the strip.
//
// Scans the full frame width at the strip's y band rather than just the
// neighborhood of the nominal position. Depending on how the user framed
// the shot, the strip may not extend to the nominal x position (e.g. only
// 60-70% of the frame), so limiting the search to ±0.08 around x=0.85
// landed on the concrete background and caused white-balance to wildly
// overcorrect — tanking all pad confidences even when pad colors were fine.
function findWhiteReference(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  nominal: { x: number; y: number }
): { cx: number; cy: number } {
  const step = 0.02
  const yRadius = 0.10
  let best = { cx: nominal.x, cy: nominal.y, score: -Infinity }
  for (let fy = nominal.y - yRadius; fy <= nominal.y + yRadius + 1e-9; fy += step) {
    for (let fx = step; fx <= 1 - step + 1e-9; fx += step) {
      if (fy < 0 || fy > 1) continue
      const rgb = samplePixel(ctx, fx * imgW, fy * imgH)
      const brightness = Math.min(rgb[0], rgb[1], rgb[2])
      const saturation = Math.max(rgb[0], rgb[1], rgb[2]) - brightness
      const score = brightness - saturation * 2
      if (score > best.score) best = { cx: fx, cy: fy, score }
    }
  }
  return best
}

export default function ScanStrip({
  stripBrand,
  onConfirm,
  onClose,
}: {
  stripBrand?: string | null
  onConfirm: (values: Partial<Record<StripParamKey, string>>) => void
  onClose: () => void
}) {
  const pins = pinsForBrand(stripBrand)
  const padLayout = stripLayoutForBrand(stripBrand)
  const [step, setStep] = useState<Step>('intro')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Record<StripParamKey, ResultRow> | null>(null)
  const [editingText, setEditingText] = useState<Record<StripParamKey, string> | null>(null)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraContainerRef = useRef<HTMLDivElement | null>(null)

  // Stop stream whenever the component unmounts
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()) }, [])

  // Wire the stream to the video element once the camera step renders
  useEffect(() => {
    if (step === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [step])

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function handleOpenCamera() {
    setError('')
    // Prefer getUserMedia — lets us show the guide overlay and crop before analysis.
    // Falls back to the Capacitor Camera plugin if getUserMedia isn't available.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        streamRef.current = stream
        setStep('camera')
        return
      } catch {
        // getUserMedia denied or unavailable — fall through
      }
    }
    handleTakePhotoLegacy()
  }

  async function handleTakePhotoLegacy() {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        webUseInput: !Capacitor.isNativePlatform(),
        quality: 85,
        promptLabelHeader: 'Scan Test Strip',
        promptLabelPhoto: 'Choose from Library',
        promptLabelPicture: 'Take Photo',
      })
      if (photo.dataUrl) setPhotoDataUrl(photo.dataUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string })?.code ?? ''
      if (!/cancel/i.test(message)) {
        setError(`${message}${code ? ` (${code})` : ''}`)
      }
    }
  }

  function captureFrame() {
    const video = videoRef.current
    const container = cameraContainerRef.current
    if (!video || !container || !video.videoWidth) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    const cw = container.clientWidth
    const ch = container.clientHeight

    // Map guide rect (CSS fractions of container) → video pixel crop.
    // object-fit: cover scales the video up to fill the container on its
    // shorter axis, then centers it — overflowing (and clipping) the other
    // axis. The guide overlay is drawn as container-relative percentages,
    // so it always lines up with what's visibly on screen; this converts
    // those same container fractions into video pixel coordinates by
    // accounting for that overflow, matching what the user actually sees.
    const scale = Math.max(cw / vw, ch / vh)
    const overflowX = vw * scale - cw
    const overflowY = vh * scale - ch

    const cropX = Math.max(0, Math.round((cw * GUIDE.x + overflowX / 2) / scale))
    const cropY = Math.max(0, Math.round((ch * GUIDE.y + overflowY / 2) / scale))
    const cropW = Math.min(vw - cropX, Math.round(cw * GUIDE.w / scale))
    const cropH = Math.min(vh - cropY, Math.round(ch * GUIDE.h / scale))

    const canvas = document.createElement('canvas')
    canvas.width = cropW
    canvas.height = cropH
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

    stopCamera()
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.95))
    setStep('intro') // hidden img in the intro step fires handlePhotoLoaded
  }

  function handlePhotoLoaded() {
    const img = imgRef.current
    if (!img || !img.naturalWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)

    const sampleRadius = Math.max(6, Math.round(img.naturalWidth * 0.015))
    const sample = (x: number, y: number) => averageColor(ctx, x * img.naturalWidth, y * img.naturalHeight, sampleRadius)

    const whiteBest = findWhiteReference(ctx, img.naturalWidth, img.naturalHeight, pins.white_reference)
    const whiteRgb = sample(whiteBest.cx, whiteBest.cy)

    const coarseY = findStripRow(ctx, img.naturalWidth, img.naturalHeight)
    const blobs = findPadBlobs(ctx, img.naturalWidth, img.naturalHeight, coarseY)
    const blobMatches = matchBlobsToPins(blobs, pins, STRIP_PARAMS.map(p => p.key))

    const next: Record<StripParamKey, ResultRow> = {} as Record<StripParamKey, ResultRow>
    for (const p of STRIP_PARAMS) {
      const pin = pins[p.key]
      const matched = blobMatches[p.key]
      const best = matched
        ? { cx: matched.xCenter, cy: matched.y }
        : findBestPin(ctx, img.naturalWidth, img.naturalHeight, p.key, pin, whiteRgb)
      const raw = sample(best.cx, best.cy)
      const corrected = whiteBalance(raw, whiteRgb)
      const { value, confidence } = matchSwatch(p.key, corrected)
      next[p.key] = { value, confidence, rgb: corrected }
    }

    setResults(next)
    setEditingText(Object.fromEntries(STRIP_PARAMS.map(p => [p.key, next[p.key].value.toFixed(p.decimals)])) as Record<StripParamKey, string>)

    const avgConfidence = STRIP_PARAMS.reduce((sum, p) => sum + next[p.key].confidence, 0) / STRIP_PARAMS.length
    setStep(avgConfidence < RETAKE_CONFIDENCE_THRESHOLD ? 'unclear' : 'review')
  }

  function adjustValue(key: StripParamKey, value: number) {
    const decimals = STRIP_PARAMS.find(p => p.key === key)?.decimals ?? 1
    setResults(prev => prev ? { ...prev, [key]: { ...prev[key], value } } : prev)
    setEditingText(prev => prev ? { ...prev, [key]: value.toFixed(decimals) } : prev)
  }

  function handleValueTextChange(key: StripParamKey, raw: string) {
    setEditingText(prev => prev ? { ...prev, [key]: raw } : prev)
  }

  function handleValueTextBlur(key: StripParamKey) {
    const p = STRIP_PARAMS.find(pp => pp.key === key)
    if (!p) return
    setEditingText(prevText => {
      const raw = (prevText?.[key] ?? '').trim()
      let parsed = parseFloat(raw)
      if (!raw.includes('.') && raw.length === 2 && !isNaN(parsed) && parsed > p.max) {
        const reinterpreted = parseFloat(`${raw[0]}.${raw[1]}`)
        if (!isNaN(reinterpreted)) parsed = reinterpreted
      }
      const clamped = isNaN(parsed) ? (results?.[key].value ?? p.min) : Math.max(p.min, Math.min(p.max, parsed))
      setResults(prev => prev ? { ...prev, [key]: { ...prev[key], value: clamped } } : prev)
      return prevText ? { ...prevText, [key]: clamped.toFixed(p.decimals) } : prevText
    })
  }

  function retake() {
    stopCamera()
    setPhotoDataUrl(null)
    setResults(null)
    setEditingText(null)
    setStep('intro')
  }

  function handleUseValues() {
    if (!results) return
    const out: Partial<Record<StripParamKey, string>> = {}
    for (const p of STRIP_PARAMS) out[p.key] = results[p.key].value.toFixed(p.decimals)
    onConfirm(out)
  }

  const padLayoutGuide = (
    <div className="rounded-xl px-3 py-3" style={{ background: '#0B1E35' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Lay your strip left to right like this:</p>
      <div className="flex items-center gap-1">
        {padLayout.map((pad, i) => (
          <div key={i} className="flex-1 text-center">
            <div
              className="rounded-md mb-1"
              style={{ height: 18, background: pad.tracked ? '#0078B8' : 'rgba(255,255,255,0.15)', opacity: pad.tracked ? 1 : 0.6 }}
            />
            <p className="text-[8px] font-semibold leading-tight" style={{ color: pad.tracked ? '#fff' : 'rgba(255,255,255,0.4)' }}>{pad.label}</p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full flex flex-col" style={{ maxWidth: 480, maxHeight: '90vh' }}>
        <div className="bg-pool-deep px-5 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Oswald',sans-serif" }}>Scan Test Strip</h2>
          <button onClick={() => { stopCamera(); onClose() }} className="text-white/70 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

          {/* ── Live camera viewfinder with guide overlay ── */}
          {step === 'camera' && (
            <div className="space-y-3">
              <p className="text-xs text-center font-semibold" style={{ color: '#0B4A70' }}>
                Fill the strip inside the frame, then tap Capture
              </p>

              {/* Viewfinder */}
              <div
                ref={cameraContainerRef}
                className="relative rounded-xl overflow-hidden bg-black"
                style={{ height: 300 }}
              >
                {/* Live video feed */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full"
                  style={{ objectFit: 'cover' }}
                />

                {/* Darkened panels around the guide rect */}
                <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: `${GUIDE.y * 100}%`, background: 'rgba(0,0,0,0.6)' }} />
                <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: `${(1 - GUIDE.y - GUIDE.h) * 100}%`, background: 'rgba(0,0,0,0.6)' }} />
                <div className="absolute left-0 pointer-events-none" style={{ top: `${GUIDE.y * 100}%`, height: `${GUIDE.h * 100}%`, width: `${GUIDE.x * 100}%`, background: 'rgba(0,0,0,0.6)' }} />
                <div className="absolute right-0 pointer-events-none" style={{ top: `${GUIDE.y * 100}%`, height: `${GUIDE.h * 100}%`, width: `${(1 - GUIDE.x - GUIDE.w) * 100}%`, background: 'rgba(0,0,0,0.6)' }} />

                {/* Guide border */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${GUIDE.x * 100}%`,
                    top: `${GUIDE.y * 100}%`,
                    width: `${GUIDE.w * 100}%`,
                    height: `${GUIDE.h * 100}%`,
                    border: '1.5px solid rgba(255,255,255,0.75)',
                    borderRadius: 4,
                  }}
                />

                {/* Corner accent marks */}
                {([
                  { top: `${GUIDE.y * 100}%`,             left:  `${GUIDE.x * 100}%`,             borderTop: '3px solid #0078B8', borderLeft:  '3px solid #0078B8' },
                  { top: `${GUIDE.y * 100}%`,             right: `${(1-GUIDE.x-GUIDE.w)*100}%`,   borderTop: '3px solid #0078B8', borderRight: '3px solid #0078B8' },
                  { bottom: `${(1-GUIDE.y-GUIDE.h)*100}%`, left:  `${GUIDE.x * 100}%`,             borderBottom: '3px solid #0078B8', borderLeft:  '3px solid #0078B8' },
                  { bottom: `${(1-GUIDE.y-GUIDE.h)*100}%`, right: `${(1-GUIDE.x-GUIDE.w)*100}%`,   borderBottom: '3px solid #0078B8', borderRight: '3px solid #0078B8' },
                ] as React.CSSProperties[]).map((style, i) => (
                  <div key={i} className="absolute pointer-events-none" style={{ ...style, width: 18, height: 18 }} />
                ))}

                {/* In-frame label */}
                <div
                  className="absolute pointer-events-none flex items-center justify-center"
                  style={{
                    left: `${GUIDE.x * 100}%`,
                    top: `${GUIDE.y * 100}%`,
                    width: `${GUIDE.w * 100}%`,
                    height: `${GUIDE.h * 100}%`,
                  }}
                >
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.15em' }}>
                    ← align strip here →
                  </p>
                </div>
              </div>

              <button
                onClick={captureFrame}
                className="w-full text-white font-bold py-4 rounded-xl text-sm"
                style={{ background: '#0078B8' }}
              >
                Capture →
              </button>
              <button
                onClick={() => { stopCamera(); setStep('intro') }}
                className="w-full text-sm font-semibold py-2 text-text-muted"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Intro / instructions ── */}
          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted leading-relaxed">
                Dip your strip, wait the usual 15 seconds, then lay it flat with the pads running left to right. Tap Open Camera, align the strip in the guide frame, and tap Capture — we&apos;ll read the colors automatically. You&apos;ll get to check and adjust every value before saving.
              </p>

              {padLayoutGuide}

              <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: 'rgba(0,120,184,0.06)', border: '1px solid rgba(0,120,184,0.15)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <p className="text-[11px] leading-snug" style={{ color: '#0B4A70' }}>Use bright, even light — daylight or indoor lighting works best. Avoid direct flash and deep shadows, which can shift how the colors read.</p>
              </div>

              <button
                onClick={handleOpenCamera}
                className="w-full text-white font-bold py-4 rounded-xl text-sm"
                style={{ background: '#0078B8' }}
              >
                Open Camera →
              </button>

              {photoDataUrl && (
                // Hidden loader — fires handlePhotoLoaded once the cropped image is ready.
                // eslint-disable-next-line @next/next/no-img-element
                <img ref={imgRef} src={photoDataUrl} alt="" className="hidden" onLoad={handlePhotoLoaded} />
              )}
            </div>
          )}

          {/* ── Low-confidence retake prompt ── */}
          {step === 'unclear' && (
            <div className="space-y-4">
              <div className="rounded-xl px-3.5 py-3.5 flex items-start gap-2.5" style={{ background: 'rgba(229,48,74,0.08)', border: '1.5px solid rgba(229,48,74,0.3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5304A" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="text-xs leading-relaxed" style={{ color: '#7A1D2E' }}>
                  <span className="font-bold">Couldn&apos;t read your strip clearly.</span> Make sure the strip fills the guide frame end-to-end, is lying flat, and is in good light. Try again or enter values manually.
                </p>
              </div>

              {padLayoutGuide}

              <button onClick={retake} className="w-full text-white font-bold py-4 rounded-xl text-sm" style={{ background: '#0078B8' }}>
                Retake →
              </button>
              <button onClick={() => setStep('review')} className="w-full text-sm font-semibold py-2 text-text-muted">
                Use these readings anyway
              </button>
            </div>
          )}

          {/* ── Review / adjust results ── */}
          {step === 'review' && results && (
            <div className="space-y-4">
              {photoDataUrl && (
                <ZoomableImage src={photoDataUrl} alt="Captured test strip" height={200} />
              )}
              <p className="text-xs font-semibold text-text-primary">Check each value against your strip — drag the slider to adjust anything that looks off.</p>

              <div className="space-y-3">
                {STRIP_PARAMS.map(p => {
                  const row = results[p.key]
                  const confColor = row.confidence > 0.7 ? '#1DB869' : row.confidence > 0.4 ? '#F5A623' : '#E5304A'
                  const confLabel = row.confidence > 0.7 ? 'Good match' : row.confidence > 0.4 ? 'Uncertain' : 'Low confidence'
                  return (
                    <div key={p.key} className="bg-surface rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div
                          className="w-6 h-6 rounded-full shrink-0 border border-black/10"
                          style={{ background: `rgb(${row.rgb[0]},${row.rgb[1]},${row.rgb[2]})` }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-primary">{p.label}</p>
                          <p className="text-[10px] font-semibold" style={{ color: confColor }}>{confLabel}</p>
                        </div>
                        <div className="flex items-baseline gap-1 shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingText?.[p.key] ?? row.value.toFixed(p.decimals)}
                            onChange={e => handleValueTextChange(p.key, e.target.value)}
                            onBlur={() => handleValueTextBlur(p.key)}
                            className="text-lg font-bold text-right outline-none bg-white rounded-lg px-2 py-1"
                            style={{ fontFamily: "'DM Mono',monospace", color: '#0078B8', width: 64 }}
                          />
                          {p.unit && <span className="text-[10px] text-text-faint font-semibold">{p.unit}</span>}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={row.value}
                        onChange={e => adjustValue(p.key, parseFloat(e.target.value))}
                        className="w-full"
                        style={{ accentColor: '#0078B8' }}
                      />
                      {p.key === 'cya' && (
                        <div className="mt-2 pt-2 border-t border-white">
                          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A8A' }}>Or pick your strip&apos;s color band:</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {CYA_STRIP_BANDS.map((band, bi) => {
                              const isActive = Math.round(row.value) === band.midpoint
                              return (
                                <button
                                  key={bi}
                                  type="button"
                                  onClick={() => adjustValue('cya', band.midpoint)}
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
                                  style={{
                                    background: isActive ? '#0078B8' : 'rgba(0,120,184,0.08)',
                                    color: isActive ? '#fff' : '#4A7A9A',
                                    border: `1.5px solid ${isActive ? '#0078B8' : 'rgba(0,120,184,0.20)'}`,
                                  }}
                                >
                                  {band.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="rounded-xl px-3.5 py-3 flex items-start gap-2.5" style={{ background: 'rgba(245,166,35,0.14)', border: '1.5px solid #D97706' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="text-xs leading-snug" style={{ color: '#7A4A00' }}><span className="font-bold">Double-check before dosing:</span> these are estimates from a photo, not a lab reading — always compare against your strip&apos;s color chart.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={retake} className="flex-1 text-sm font-semibold py-3 rounded-xl text-text-muted border border-gray-200">
                  Retake
                </button>
                <button
                  onClick={handleUseValues}
                  className="flex-1 text-white font-bold py-3 rounded-xl text-sm"
                  style={{ background: '#0078B8' }}
                >
                  Use These Values →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
