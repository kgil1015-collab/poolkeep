'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import {
  STRIP_PARAMS,
  DEFAULT_PINS,
  loadSavedPins,
  savePins,
  whiteBalance,
  matchSwatch,
  type StripParamKey,
  type PinKey,
  type PinPosition,
  type RGB,
} from '@/lib/stripScan'

type Step = 'intro' | 'placing' | 'review'

interface ReviewRow {
  value: string
  confidence: number
  rgb: RGB
}

function containRect(containerW: number, containerH: number, imgW: number, imgH: number) {
  const containerRatio = containerW / containerH
  const imgRatio = imgW / imgH
  let w: number, h: number
  if (imgRatio > containerRatio) {
    w = containerW
    h = containerW / imgRatio
  } else {
    h = containerH
    w = containerH * imgRatio
  }
  return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h }
}

function pinToNaturalPx(
  pin: PinPosition,
  containerW: number, containerH: number,
  naturalW: number, naturalH: number,
) {
  const rect = containRect(containerW, containerH, naturalW, naturalH)
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const rx = clamp(((pin.x * containerW) - rect.x) / rect.w)
  const ry = clamp(((pin.y * containerH) - rect.y) / rect.h)
  return { x: rx * naturalW, y: ry * naturalH }
}

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

export default function ScanStrip({
  onConfirm,
  onClose,
}: {
  onConfirm: (values: Partial<Record<StripParamKey, string>>) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('intro')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [pins, setPins] = useState<Record<PinKey, PinPosition>>(DEFAULT_PINS)
  const [review, setReview] = useState<Record<StripParamKey, ReviewRow> | null>(null)
  const [error, setError] = useState('')
  const [loupe, setLoupe] = useState<{ screenX: number; screenY: number; naturalX: number; naturalY: number } | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const draggingKey = useRef<PinKey | null>(null)
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null)

  function updateLoupe(clientX: number, clientY: number, pin: PinPosition) {
    const rect = containerRef.current?.getBoundingClientRect()
    const img = imgRef.current
    if (!rect || !img || !img.naturalWidth) return
    const { x: naturalX, y: naturalY } = pinToNaturalPx(pin, rect.width, rect.height, img.naturalWidth, img.naturalHeight)
    setLoupe({ screenX: clientX - rect.left, screenY: clientY - rect.top, naturalX, naturalY })
  }

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      const key = draggingKey.current
      if (!key || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      setPins(prev => ({ ...prev, [key]: { x, y } }))
      updateLoupe(e.clientX, e.clientY, { x, y })
    }
    function handleUp() { draggingKey.current = null; setLoupe(null) }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [])

  // Draw the zoomed magnifier crop whenever the loupe position updates
  useEffect(() => {
    if (!loupe || !imgRef.current || !loupeCanvasRef.current) return
    const canvas = loupeCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ZOOM = 3.5
    const size = canvas.width
    const cropSize = size / ZOOM
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(
      imgRef.current,
      loupe.naturalX - cropSize / 2, loupe.naturalY - cropSize / 2, cropSize, cropSize,
      0, 0, size, size,
    )
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(size / 2 - 9, size / 2); ctx.lineTo(size / 2 + 9, size / 2)
    ctx.moveTo(size / 2, size / 2 - 9); ctx.lineTo(size / 2, size / 2 + 9)
    ctx.stroke()
  }, [loupe])

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
        setPins(loadSavedPins())
        setStep('placing')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string })?.code ?? ''
      if (!/cancel/i.test(message)) {
        // TEMPORARY: showing the raw error for diagnosis — revert to a friendly
        // message once the native camera issue is confirmed fixed.
        setError(`Could not open the camera: ${message}${code ? ` (${code})` : ''}`)
      }
    }
  }

  function handleAnalyze() {
    const img = imgRef.current
    if (!img || !containerRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)

    const rect = containerRef.current.getBoundingClientRect()
    const sampleRadius = Math.max(6, Math.round(img.naturalWidth * 0.015))
    const sample = (pin: PinPosition) => {
      const { x, y } = pinToNaturalPx(pin, rect.width, rect.height, img.naturalWidth, img.naturalHeight)
      return averageColor(ctx, x, y, sampleRadius)
    }

    const whiteRgb = sample(pins.white_reference)
    const next: Record<StripParamKey, ReviewRow> = {} as Record<StripParamKey, ReviewRow>
    for (const p of STRIP_PARAMS) {
      const raw = sample(pins[p.key])
      const corrected = whiteBalance(raw, whiteRgb)
      const { value, confidence } = matchSwatch(p.key, corrected)
      next[p.key] = { value: value.toFixed(p.decimals), confidence, rgb: corrected }
    }
    setReview(next)
    savePins(pins)
    setStep('review')
  }

  function handleUseValues() {
    if (!review) return
    const values: Partial<Record<StripParamKey, string>> = {}
    for (const p of STRIP_PARAMS) values[p.key] = review[p.key].value
    onConfirm(values)
  }

  function retake() {
    setPhotoDataUrl(null)
    setReview(null)
    setStep('intro')
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
                Dip your strip, wait the usual 15 seconds, then lay it flat in good light. Hold your phone directly above it and get close enough that the strip fills most of the frame — that makes the pads much easier to line up. Take a photo and we&apos;ll estimate your readings from the pad colors — you&apos;ll get a chance to check them before saving.
              </p>
              <button
                onClick={handleTakePhoto}
                className="w-full text-white font-bold py-4 rounded-xl text-sm"
                style={{ background: '#0078B8' }}
              >
                Open Camera →
              </button>
              <p className="text-[11px] text-text-faint text-center">
                Estimates from a photo aren&apos;t as precise as reading the chart yourself — always double-check before saving.
              </p>
            </div>
          )}

          {step === 'placing' && photoDataUrl && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-text-primary">
                Drag each pin onto the matching pad — a magnified view pops up above your finger while you drag so you can place it precisely. Drag the gray pin onto a plain white/light part of the strip (for lighting correction).
              </p>
              <div
                ref={containerRef}
                className="relative w-full rounded-xl overflow-hidden bg-black"
                style={{ height: 'min(56vh, 460px)', touchAction: 'none' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={photoDataUrl}
                  alt="Captured test strip"
                  className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                  draggable={false}
                />
                {(Object.keys(pins) as PinKey[]).map(key => {
                  const pin = pins[key]
                  const meta = STRIP_PARAMS.find(p => p.key === key)
                  const label = meta ? meta.short : 'W'
                  const bg = key === 'white_reference' ? '#7A8A94' : '#0078B8'
                  return (
                    <div
                      key={key}
                      onPointerDown={e => {
                        e.preventDefault()
                        draggingKey.current = key
                        updateLoupe(e.clientX, e.clientY, pin)
                      }}
                      style={{
                        position: 'absolute',
                        left: `${pin.x * 100}%`,
                        top: `${pin.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 34, height: 34,
                        borderRadius: '50%',
                        background: bg,
                        border: '2px solid white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 10, fontWeight: 700,
                        cursor: 'grab',
                        touchAction: 'none',
                      }}
                    >
                      {label}
                    </div>
                  )
                })}
                {loupe && (
                  <div
                    style={{
                      position: 'absolute',
                      left: loupe.screenX,
                      top: Math.max(55, loupe.screenY - 95),
                      transform: 'translate(-50%, -50%)',
                      width: 110, height: 110,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '3px solid white',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                      pointerEvents: 'none',
                      zIndex: 20,
                    }}
                  >
                    <canvas ref={loupeCanvasRef} width={110} height={110} style={{ width: '100%', height: '100%' }} />
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={retake} className="flex-1 text-sm font-semibold py-3 rounded-xl text-text-muted border border-gray-200">
                  Retake
                </button>
                <button
                  onClick={handleAnalyze}
                  className="flex-1 text-white font-bold py-3 rounded-xl text-sm"
                  style={{ background: '#0078B8' }}
                >
                  Read Colors →
                </button>
              </div>
            </div>
          )}

          {step === 'review' && review && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-text-primary">Check these against your strip before saving — tap any value to fix it.</p>
              <div className="space-y-2">
                {STRIP_PARAMS.map(p => {
                  const row = review[p.key]
                  const confColor = row.confidence > 0.7 ? '#1DB869' : row.confidence > 0.4 ? '#F5A623' : '#E5304A'
                  const confLabel = row.confidence > 0.7 ? 'Good match' : row.confidence > 0.4 ? 'Uncertain' : 'Low confidence'
                  return (
                    <div key={p.key} className="flex items-center gap-3 bg-surface rounded-xl px-3 py-2.5">
                      <div
                        className="w-8 h-8 rounded-full shrink-0 border border-black/10"
                        style={{ background: `rgb(${row.rgb[0]},${row.rgb[1]},${row.rgb[2]})` }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-text-primary">{p.label}</p>
                        <p className="text-[10px] font-semibold" style={{ color: confColor }}>{confLabel}</p>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.value}
                        onChange={e => setReview(prev => prev ? { ...prev, [p.key]: { ...prev[p.key], value: e.target.value } } : prev)}
                        className="w-20 text-right text-lg font-bold outline-none bg-white rounded-lg px-2 py-1.5"
                        style={{ fontFamily: "'DM Mono',monospace", color: '#0078B8' }}
                      />
                      {p.unit && <span className="text-[10px] font-bold text-text-faint shrink-0">{p.unit}</span>}
                    </div>
                  )
                })}
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
