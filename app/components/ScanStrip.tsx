'use client'

import { useRef, useState } from 'react'
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

type Step = 'intro' | 'review' | 'unclear'

// Below this average confidence across all sampled pads, the sample points
// are more likely landing on the wrong spots entirely (reversed strip,
// diagonal placement, wrong zoom) than just genuinely ambiguous colors —
// worth a retake prompt instead of confidently showing garbage numbers.
const RETAKE_CONFIDENCE_THRESHOLD = 0.35

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

// Real photos rarely land a pad at PIN_LAYOUTS' exact fractional position —
// framing and zoom vary between photos, and any slight tilt in how the
// strip was laid down drifts the pad row's y-position across the strip's
// width (confirmed 2026-08-16 against real strip photos: a "flat, centered"
// strip still showed ~0.03 of y-drift from left pad to right pad). Instead
// of trusting the nominal point outright, probe a neighborhood around it
// and keep whichever spot best matches this param's own reference swatches
// — a wrong-colored neighboring pad scores badly against the wrong swatch
// list, so this self-corrects without needing to know the strip's exact
// position or angle.
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

// White reference has no swatch list to score against, so instead of
// matching a param it prefers whichever nearby point is brightest and least
// saturated (most neutral) — that's what the strip's own blank plastic
// looks like, versus colored pads or the (usually darker, textured)
// background behind the strip.
function findWhiteReference(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  nominal: { x: number; y: number }
): { cx: number; cy: number } {
  const xRadius = 0.08
  const yRadius = 0.08
  const step = 0.01
  let best = { cx: nominal.x, cy: nominal.y, score: -Infinity }
  for (let dy = -yRadius; dy <= yRadius + 1e-9; dy += step) {
    for (let dx = -xRadius; dx <= xRadius + 1e-9; dx += step) {
      const fx = nominal.x + dx
      const fy = nominal.y + dy
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) continue
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

    const whiteBest = findWhiteReference(ctx, img.naturalWidth, img.naturalHeight, pins.white_reference)
    const whiteRgb = sample(whiteBest.cx, whiteBest.cy)
    const next: Record<StripParamKey, ResultRow> = {} as Record<StripParamKey, ResultRow>
    for (const p of STRIP_PARAMS) {
      const pin = pins[p.key]
      const best = findBestPin(ctx, img.naturalWidth, img.naturalHeight, p.key, pin, whiteRgb)
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

              {/* Brand-specific orientation guide — reading pads in the wrong
                  order (reversed strip, wrong pad count) is the single
                  biggest cause of bad scans, more than lighting or angle. */}
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
                // Hidden loader — draws once, then jumps to review (or back
                // to this screen with a retake prompt if confidence is low).
                // eslint-disable-next-line @next/next/no-img-element
                <img ref={imgRef} src={photoDataUrl} alt="" className="hidden" onLoad={handlePhotoLoaded} />
              )}
            </div>
          )}

          {step === 'unclear' && (
            <div className="space-y-4">
              <div className="rounded-xl px-3.5 py-3.5 flex items-start gap-2.5" style={{ background: 'rgba(229,48,74,0.08)', border: '1.5px solid rgba(229,48,74,0.3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5304A" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="text-xs leading-relaxed" style={{ color: '#7A1D2E' }}><span className="font-bold">Couldn&apos;t read your strip clearly.</span> This usually means the strip wasn&apos;t laid out in the expected order, was tilted, or wasn&apos;t centered in the frame. Check the layout guide below and try again.</p>
              </div>
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
              <button onClick={retake} className="w-full text-white font-bold py-4 rounded-xl text-sm" style={{ background: '#0078B8' }}>
                Retake Photo →
              </button>
              <button onClick={() => setStep('review')} className="w-full text-sm font-semibold py-2 text-text-muted">
                Use these readings anyway
              </button>
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
