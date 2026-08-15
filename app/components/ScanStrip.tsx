'use client'

import { useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import ZoomableImage from '@/app/components/ZoomableImage'
import {
  STRIP_PARAMS,
  DEFAULT_PINS,
  CYA_STRIP_BANDS,
  whiteBalance,
  matchSwatch,
  type StripParamKey,
  type RGB,
} from '@/lib/stripScan'

type Step = 'intro' | 'review'

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

export default function ScanStrip({
  onConfirm,
  onClose,
}: {
  onConfirm: (values: Partial<Record<StripParamKey, string>>) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('intro')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Record<StripParamKey, ResultRow> | null>(null)
  const [editingText, setEditingText] = useState<Record<StripParamKey, string> | null>(null)

  const imgRef = useRef<HTMLImageElement | null>(null)

  async function handleTakePhoto() {
    setError('')
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        // In a plain mobile browser (no native app installed yet), CameraSource.Prompt's
        // "choose Camera or Photos" sheet requires the separate @ionic/pwa-elements
        // package, which isn't installed — without it the picker silently hangs forever.
        // webUseInput routes to a plain <input type="file"> instead, which needs no
        // extra dependency there. But inside the native app this same code runs in a
        // webview loading the live site, so unconditionally setting this also forced
        // native builds onto that same plain file-input fallback — which only offers
        // picking an existing photo, never opening the camera. Scope it to the actual
        // plain-browser case only.
        webUseInput: !Capacitor.isNativePlatform(),
        quality: 85,
        promptLabelHeader: 'Scan Test Strip',
        promptLabelPhoto: 'Choose from Library',
        promptLabelPicture: 'Take Photo',
      })
      if (photo.dataUrl) {
        setPhotoDataUrl(photo.dataUrl)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string })?.code ?? ''
      if (!/cancel/i.test(message)) {
        // TEMPORARY: showing the raw error for diagnosis — revert to a friendly
        // message once the Android camera issue is confirmed fixed.
        setError(`${message}${code ? ` (${code})` : ''}`)
      }
    }
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

    const whiteRgb = sample(DEFAULT_PINS.white_reference.x, DEFAULT_PINS.white_reference.y)
    const next: Record<StripParamKey, ResultRow> = {} as Record<StripParamKey, ResultRow>
    for (const p of STRIP_PARAMS) {
      const pin = DEFAULT_PINS[p.key]
      const raw = sample(pin.x, pin.y)
      const corrected = whiteBalance(raw, whiteRgb)
      const { value, confidence } = matchSwatch(p.key, corrected)
      next[p.key] = { value, confidence, rgb: corrected }
    }
    setResults(next)
    setEditingText(Object.fromEntries(STRIP_PARAMS.map(p => [p.key, next[p.key].value.toFixed(p.decimals)])) as Record<StripParamKey, string>)
    setStep('review')
  }

  // Slider drag — updates both the numeric value and the text box in sync
  function adjustValue(key: StripParamKey, value: number) {
    const decimals = STRIP_PARAMS.find(p => p.key === key)?.decimals ?? 1
    setResults(prev => prev ? { ...prev, [key]: { ...prev[key], value } } : prev)
    setEditingText(prev => prev ? { ...prev, [key]: value.toFixed(decimals) } : prev)
  }

  // Typing in the value box — let them type freely, only commit/clamp on blur
  function handleValueTextChange(key: StripParamKey, raw: string) {
    setEditingText(prev => prev ? { ...prev, [key]: raw } : prev)
  }

  function handleValueTextBlur(key: StripParamKey) {
    const p = STRIP_PARAMS.find(pp => pp.key === key)
    if (!p) return
    setEditingText(prevText => {
      const raw = (prevText?.[key] ?? '').trim()
      let parsed = parseFloat(raw)
      // Two-digit whole number with no decimal, out of range as typed — assume
      // they meant to type a decimal point (e.g. "64" for pH means 6.4, not
      // literally 64) rather than just clamping it straight to the max.
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
                Dip your strip, wait the usual 15 seconds, then lay it flat with the pads running left to right, centered in the frame. Take a photo and we&apos;ll read the colors automatically — you&apos;ll get to check and adjust every value before saving.
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
              {photoDataUrl && (
                // Hidden loader — draws once, then jumps straight to the review step.
                // eslint-disable-next-line @next/next/no-img-element
                <img ref={imgRef} src={photoDataUrl} alt="" className="hidden" onLoad={handlePhotoLoaded} />
              )}
            </div>
          )}

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
