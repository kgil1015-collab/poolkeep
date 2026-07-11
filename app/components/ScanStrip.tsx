'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

export type ScanParamKey = 'ph' | 'free_chlorine' | 'total_alkalinity' | 'cya' | 'calcium_hardness'

export const SCAN_PARAMS: { key: ScanParamKey; label: string; unit: string }[] = [
  { key: 'ph',               label: 'pH',                  unit: '' },
  { key: 'free_chlorine',    label: 'Free Chlorine',       unit: 'ppm' },
  { key: 'total_alkalinity', label: 'Total Alkalinity',    unit: 'ppm' },
  { key: 'cya',              label: 'Cyanuric Acid (CYA)', unit: 'ppm' },
  { key: 'calcium_hardness', label: 'Water Hardness',      unit: 'ppm' },
]

type Step = 'intro' | 'placing' | 'review'
type TapPos = { x: number; y: number } // fractional 0..1 within the displayed photo

function containRect(containerW: number, containerH: number, imgW: number, imgH: number) {
  const containerRatio = containerW / containerH
  const imgRatio = imgW / imgH
  let w: number, h: number
  if (imgRatio > containerRatio) { w = containerW; h = containerW / imgRatio }
  else { h = containerH; w = containerH * imgRatio }
  return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h }
}

function tapToNaturalPx(pos: TapPos, containerW: number, containerH: number, naturalW: number, naturalH: number) {
  const rect = containRect(containerW, containerH, naturalW, naturalH)
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const rx = clamp(((pos.x * containerW) - rect.x) / rect.w)
  const ry = clamp(((pos.y * containerH) - rect.y) / rect.h)
  return { x: rx * naturalW, y: ry * naturalH }
}

export default function ScanStrip({
  onConfirm,
  onClose,
}: {
  onConfirm: (values: Partial<Record<ScanParamKey, string>>) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('intro')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [values, setValues] = useState<Record<ScanParamKey, string>>({ ph: '', free_chlorine: '', total_alkalinity: '', cya: '', calcium_hardness: '' })
  const [tapPositions, setTapPositions] = useState<Partial<Record<ScanParamKey, TapPos>>>({})
  const [skipped, setSkipped] = useState<Set<ScanParamKey>>(new Set())

  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const current = SCAN_PARAMS[currentIndex]
  const currentTap = current ? tapPositions[current.key] : undefined

  async function handleTakePhoto() {
    setError('')
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        // In a plain mobile browser (no native app installed yet), CameraSource.Prompt's
        // "choose Camera or Photos" sheet requires the separate @ionic/pwa-elements
        // package, which isn't installed — without it the picker silently hangs forever.
        // webUseInput routes to a plain <input type="file" capture> instead, which needs
        // no extra dependency and works the same on native once that's built too.
        webUseInput: true,
        quality: 85,
        promptLabelHeader: 'Scan Test Strip',
        promptLabelPhoto: 'Choose from Library',
        promptLabelPicture: 'Take Photo',
      })
      if (photo.dataUrl) {
        setPhotoDataUrl(photo.dataUrl)
        setCurrentIndex(0)
        setStep('placing')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!/cancel/i.test(message)) {
        setError('Could not open the camera. Check that PoolKeep has camera/photo permission in Settings.')
      }
    }
  }

  function handleTapPhoto(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current || !current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    setTapPositions(prev => ({ ...prev, [current.key]: { x, y } }))
    setSkipped(prev => { const next = new Set(prev); next.delete(current.key); return next })
  }

  // Redraw the zoomed close-up whenever the tap point (or step) changes
  useEffect(() => {
    const pos = currentTap
    const img = imgRef.current
    const canvas = zoomCanvasRef.current
    if (!pos || !img || !img.naturalWidth || !canvas || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const { x: nx, y: ny } = tapToNaturalPx(pos, rect.width, rect.height, img.naturalWidth, img.naturalHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ZOOM = 4
    const size = canvas.width
    const cropSize = size / ZOOM
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(img, nx - cropSize / 2, ny - cropSize / 2, cropSize, cropSize, 0, 0, size, size)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(size / 2 - 10, size / 2); ctx.lineTo(size / 2 + 10, size / 2)
    ctx.moveTo(size / 2, size / 2 - 10); ctx.lineTo(size / 2, size / 2 + 10)
    ctx.stroke()
  }, [currentTap, currentIndex])

  function setValue(val: string) {
    if (!current) return
    setValues(v => ({ ...v, [current.key]: val }))
  }

  function skipCurrent() {
    if (!current) return
    setSkipped(prev => new Set(prev).add(current.key))
    setValues(v => ({ ...v, [current.key]: '' }))
    goNext()
  }

  function goNext() {
    if (currentIndex < SCAN_PARAMS.length - 1) setCurrentIndex(i => i + 1)
    else setStep('review')
  }

  function goBack() {
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
    else setStep('intro')
  }

  function retake() {
    setPhotoDataUrl(null)
    setTapPositions({})
    setSkipped(new Set())
    setValues({ ph: '', free_chlorine: '', total_alkalinity: '', cya: '', calcium_hardness: '' })
    setCurrentIndex(0)
    setStep('intro')
  }

  function handleUseValues() {
    const out: Partial<Record<ScanParamKey, string>> = {}
    for (const p of SCAN_PARAMS) {
      if (values[p.key].trim() !== '') out[p.key] = values[p.key].trim()
    }
    onConfirm(out)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full flex flex-col" style={{ maxWidth: 480, maxHeight: '90vh' }}>
        <div className="bg-pool-deep px-5 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Oswald',sans-serif" }}>Scan Test Strip</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted leading-relaxed">
                Dip your strip, wait the usual 15 seconds, then lay it flat and take a photo. You&apos;ll tap each pad one at a time to zoom in and read it — nothing is calculated automatically, so you&apos;re always the one entering the number.
              </p>
              <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: 'rgba(0,120,184,0.06)', border: '1px solid rgba(0,120,184,0.15)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <p className="text-[11px] leading-snug" style={{ color: '#0B4A70' }}>Shoot in bright, even light — daylight or a bright room light works best. Avoid direct flash and shadows, which can shift how the colors look.</p>
              </div>
              <button
                onClick={handleTakePhoto}
                className="w-full text-white font-bold py-4 rounded-xl text-sm"
                style={{ background: '#0078B8' }}
              >
                Open Camera →
              </button>
            </div>
          )}

          {step === 'placing' && photoDataUrl && current && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-text-primary">Step {currentIndex + 1} of {SCAN_PARAMS.length} — {current.label}</p>
                <button onClick={skipCurrent} className="text-[11px] font-semibold" style={{ color: '#8AAABB' }}>Skip →</button>
              </div>
              <p className="text-[11px] text-text-muted leading-snug">Tap the {current.label} pad on the photo below to zoom in on it.</p>

              <div
                ref={containerRef}
                onClick={handleTapPhoto}
                className="relative w-full rounded-xl overflow-hidden bg-black"
                style={{ height: 220, touchAction: 'manipulation' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={photoDataUrl}
                  alt="Captured test strip"
                  className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                  draggable={false}
                />
                {currentTap && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${currentTap.x * 100}%`,
                      top: `${currentTap.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 22, height: 22,
                      borderRadius: '50%',
                      border: '2.5px solid #5BC8F5',
                      boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl overflow-hidden border-2 border-white shrink-0" style={{ width: 84, height: 84, boxShadow: '0 2px 10px rgba(0,0,0,0.2)', background: '#111' }}>
                  {currentTap ? (
                    <canvas ref={zoomCanvasRef} width={84} height={84} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[9px] text-white/50 text-center px-1">Tap photo to zoom</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1 block">{current.label}{current.unit ? ` (${current.unit})` : ''}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={values[current.key]}
                    onChange={e => setValue(e.target.value)}
                    placeholder="Type what you see"
                    className="w-full text-lg font-bold outline-none bg-surface rounded-lg px-3 py-2"
                    style={{ fontFamily: "'DM Mono',monospace", color: '#0078B8' }}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={goBack} className="flex-1 text-sm font-semibold py-3 rounded-xl text-text-muted border border-gray-200">
                  Back
                </button>
                <button
                  onClick={goNext}
                  className="flex-1 text-white font-bold py-3 rounded-xl text-sm"
                  style={{ background: '#0078B8' }}
                >
                  {currentIndex < SCAN_PARAMS.length - 1 ? 'Next →' : 'Review →'}
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-text-primary">Here&apos;s what you entered — double-check each one against your strip before saving.</p>
              <div className="space-y-2">
                {SCAN_PARAMS.map((p, i) => (
                  <button
                    key={p.key}
                    onClick={() => { setCurrentIndex(i); setStep('placing') }}
                    className="w-full flex items-center justify-between bg-surface rounded-xl px-3 py-2.5 text-left"
                  >
                    <span className="text-xs font-bold text-text-primary">{p.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ fontFamily: "'DM Mono',monospace", color: values[p.key] ? '#0078B8' : '#8AAABB' }}>
                        {values[p.key] || 'Not entered'}{values[p.key] && p.unit ? ` ${p.unit}` : ''}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8AAABB" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </span>
                  </button>
                ))}
              </div>
              <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(217,119,6,0.18)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="text-[11px] leading-snug" style={{ color: '#92600A' }}>These are only as accurate as your own read of the strip — always compare against the official color chart before dosing chemicals.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={retake} className="flex-1 text-sm font-semibold py-3 rounded-xl text-text-muted border border-gray-200">
                  Retake Photo
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
