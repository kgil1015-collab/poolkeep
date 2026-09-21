// Photo analysis for the "Scan Test Strip" feature: finds the strip's row and
// pad blobs in a canvas and samples/matches each pad. Kept separate from the
// component so the exact production logic can be run against real photos in
// tests and calibration scripts.
import {
  whiteBalance,
  matchSwatch,
  type StripParamKey,
  type StripPadInfo,
  type RGB,
} from './stripScan'

export function averageColor(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): RGB {
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

export function samplePixel(ctx: CanvasRenderingContext2D, x: number, y: number): RGB {
  const canvas = ctx.canvas
  const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x)))
  const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y)))
  const d = ctx.getImageData(px, py, 1, 1).data
  return [d[0], d[1], d[2]]
}

export function findBestPin(
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

export function findStripRow(ctx: CanvasRenderingContext2D, imgW: number, imgH: number): number {
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

export interface PadBlob { xCenter: number; y: number }

export function findPadBlobs(ctx: CanvasRenderingContext2D, imgW: number, imgH: number, coarseY: number): PadBlob[] {
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

export function matchBlobsToPins(
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

// White reference has no swatch list to score against, so it prefers
// whichever point is brightest and least saturated — the strip's own blank
// plastic (the gaps between pads and the tail past the last pad).
//
// It has to come from the strip itself: the strip sits on a background that
// is often dark, textured, or lit differently, and a reference taken from
// there over-corrects everything (confirmed 2026-09-20: with the reference
// on the background, gains of ~1.4x clipped pale pads to near-white and
// skewed every hue). So this searches a thin band around the strip row that
// findStripRow located, across the full frame width, rather than around a
// fixed spot in the frame.
export function findWhiteReference(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  stripRowY: number
): { cx: number; cy: number } {
  const step = 0.01
  const yBand = 0.03
  const radius = Math.max(2, Math.round(imgW * 0.006))
  let best = { cx: 0.5, cy: stripRowY, score: -Infinity }
  for (let fy = stripRowY - yBand; fy <= stripRowY + yBand + 1e-9; fy += step) {
    if (fy < 0 || fy > 1) continue
    for (let fx = step; fx <= 1 - step + 1e-9; fx += step) {
      const [r, g, b] = averageColor(ctx, fx * imgW, fy * imgH, radius)
      const brightness = Math.min(r, g, b)
      const saturation = Math.max(r, g, b) - brightness
      const score = brightness - saturation * 2
      if (score > best.score) best = { cx: fx, cy: fy, score }
    }
  }
  return best
}

export interface PadSlot { x: number; y: number; found: boolean }

// The pads sit at fixed, evenly spaced positions on the strip, so instead of
// trusting "nearest detected blob" for each param (which grabs the WRONG pad
// whenever one is missed — a pale Free Chlorine pad is barely more saturated
// than the plastic and often isn't detected, and its nearest neighbor is the
// untracked Total Chlorine pad), fit the layout's slot grid (x0 + i*pitch) to
// the blobs that were detected. Slots with no blob still get a predicted
// position, so a missed pale pad is sampled where it must be.
//
// Tries every pair of blobs as slot i and slot j, derives the implied pitch,
// and keeps the fit that best explains the blobs. Stray blobs past the pads
// (glare, tail-end noise) must not be able to buy a fit: the pitch is capped
// to what a strip filling the guide frame can produce, matches need to be
// tight, and blobs inside the grid's span that the grid can't explain count
// against it.
export function fitPadSlots(blobs: PadBlob[], slotCount: number, stripRowY: number): PadSlot[] | null {
  if (blobs.length < 2 || slotCount < 2) return null
  const MIN_PITCH = 0.08
  const MAX_PITCH = 0.17
  const TOLERANCE = 0.3
  let best: { x0: number; pitch: number; inliers: number; score: number } | null = null
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      for (let si = 0; si < slotCount; si++) {
        for (let sj = si + 1; sj < slotCount; sj++) {
          const pitch = (blobs[j].xCenter - blobs[i].xCenter) / (sj - si)
          if (pitch < MIN_PITCH || pitch > MAX_PITCH) continue
          const x0 = blobs[i].xCenter - pitch * si
          const last = x0 + pitch * (slotCount - 1)
          if (x0 < -0.05 || last > 1.05) continue
          let inliers = 0, err = 0
          for (let k = 0; k < slotCount; k++) {
            const px = x0 + pitch * k
            let nearest = Infinity
            for (const bl of blobs) nearest = Math.min(nearest, Math.abs(bl.xCenter - px))
            if (nearest <= pitch * TOLERANCE) { inliers++; err += nearest / pitch }
          }
          let unexplained = 0
          for (const bl of blobs) {
            if (bl.xCenter < x0 - pitch / 2 || bl.xCenter > last + pitch / 2) continue
            let nearest = Infinity
            for (let k = 0; k < slotCount; k++) nearest = Math.min(nearest, Math.abs(bl.xCenter - (x0 + pitch * k)))
            if (nearest > pitch * TOLERANCE) unexplained++
          }
          const score = inliers * 2 - unexplained - err
          if (!best || score > best.score) best = { x0, pitch, inliers, score }
        }
      }
    }
  }
  if (!best || best.inliers < 3) return null

  const slots: PadSlot[] = []
  for (let k = 0; k < slotCount; k++) {
    const px = best.x0 + best.pitch * k
    let nearest: PadBlob | null = null
    for (const b of blobs) {
      if (Math.abs(b.xCenter - px) <= best.pitch * TOLERANCE && (!nearest || Math.abs(b.xCenter - px) < Math.abs(nearest.xCenter - px))) nearest = b
    }
    slots.push(nearest ? { x: nearest.xCenter, y: nearest.y, found: true } : { x: px, y: NaN, found: false })
  }
  // Missing slots take their y from the nearest detected neighbor (follows tilt).
  for (let k = 0; k < slots.length; k++) {
    if (slots[k].found) continue
    let ref: PadSlot | null = null
    for (let d = 1; d < slots.length && !ref; d++) {
      if (k - d >= 0 && slots[k - d].found) ref = slots[k - d]
      else if (k + d < slots.length && slots[k + d].found) ref = slots[k + d]
    }
    slots[k].y = ref ? ref.y : stripRowY
  }
  return slots
}

export interface PadReading {
  value: number
  confidence: number
  raw: RGB
  corrected: RGB
  x: number
  y: number
  source: 'slot' | 'slot-predicted' | 'blob' | 'search'
}

export interface StripAnalysis {
  whiteRgb: RGB
  whitePos: { x: number; y: number }
  stripRowY: number
  blobs: PadBlob[]
  readings: Record<StripParamKey, PadReading>
}

// Full pipeline for one photo canvas: white reference, strip row, pad blobs,
// then each param's sample matched against its swatches. Used by the scan UI
// and by calibration scripts, so both always run the same logic.
export function analyzeStrip(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  pins: Record<StripParamKey | 'white_reference', { x: number; y: number }>,
  keys: StripParamKey[],
  layout?: StripPadInfo[]
): StripAnalysis {
  // Window scales with the frame (~1.5% of width) so it stays inside a pad;
  // a fixed minimum bled into the neighboring pad on small images.
  const sampleRadius = Math.max(2, Math.round(imgW * 0.015))
  const whiteRadius = Math.max(2, Math.round(imgW * 0.006))
  const sample = (x: number, y: number) => averageColor(ctx, x * imgW, y * imgH, sampleRadius)

  const stripRowY = findStripRow(ctx, imgW, imgH)
  const whiteBest = findWhiteReference(ctx, imgW, imgH, stripRowY)
  const whiteRgb = averageColor(ctx, whiteBest.cx * imgW, whiteBest.cy * imgH, whiteRadius)
  const blobs = findPadBlobs(ctx, imgW, imgH, stripRowY)
  const slots = layout ? fitPadSlots(blobs, layout.length, stripRowY) : null
  const slotFor = (key: StripParamKey): PadSlot | null => {
    if (!slots || !layout) return null
    const idx = layout.findIndex(p => p.key === key)
    return idx >= 0 ? slots[idx] : null
  }
  const blobMatches = slots ? {} : matchBlobsToPins(blobs, pins, keys)

  const readings = {} as Record<StripParamKey, PadReading>
  for (const key of keys) {
    const slot = slotFor(key)
    const matched = blobMatches[key]
    const best = slot
      ? { cx: slot.x, cy: slot.y }
      : matched
        ? { cx: matched.xCenter, cy: matched.y }
        : findBestPin(ctx, imgW, imgH, key, pins[key], whiteRgb)
    const raw = sample(best.cx, best.cy)
    const corrected = whiteBalance(raw, whiteRgb)
    const { value, confidence } = matchSwatch(key, corrected)
    readings[key] = {
      value, confidence, raw, corrected, x: best.cx, y: best.cy,
      source: slot ? (slot.found ? 'slot' : 'slot-predicted') : matched ? 'blob' : 'search',
    }
  }
  return { whiteRgb, whitePos: { x: whiteBest.cx, y: whiteBest.cy }, stripRowY, blobs, readings }
}
