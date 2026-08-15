// Color science + reference data for the "Scan Test Strip" camera feature.
//
// The reference swatches below are best-effort approximations built from the
// published color scales for the indicator chemistries most consumer 6-/7-way
// strips share (phenol red for pH, DPD for chlorine, bromocresol-type for
// alkalinity, melamine-cyanurate for CYA, calmagite-type for hardness) — not a
// specific brand's exact printed ink. Camera color capture also drifts with
// lighting, which is why every scan is white-balanced against a patch of the
// strip itself and every result is shown as an editable suggestion, never
// auto-saved.

export type StripParamKey = 'ph' | 'free_chlorine' | 'total_alkalinity' | 'cya' | 'calcium_hardness'

export interface StripParamMeta {
  key: StripParamKey
  label: string
  unit: string
  decimals: number
  min: number
  max: number
  step: number
}

export const STRIP_PARAMS: StripParamMeta[] = [
  { key: 'ph',               label: 'pH',                  unit: '',    decimals: 1, min: 6.2, max: 8.4,  step: 0.1 },
  { key: 'free_chlorine',    label: 'Free Chlorine',       unit: 'ppm', decimals: 1, min: 0,   max: 10,   step: 0.1 },
  { key: 'total_alkalinity', label: 'Total Alkalinity',    unit: 'ppm', decimals: 0, min: 0,   max: 240,  step: 5 },
  { key: 'cya',              label: 'Cyanuric Acid (CYA)', unit: 'ppm', decimals: 0, min: 0,   max: 110,  step: 5 },
  { key: 'calcium_hardness', label: 'Water Hardness',      unit: 'ppm', decimals: 0, min: 25,  max: 1000, step: 25 },
]

// AquaChek 7 / HTH strip CYA color bands → stored as midpoint ppm. Most
// consumer strips only distinguish bands for CYA, not a precise number, so
// this is offered as an alternative to typing/sliding an exact value —
// shared between the manual entry form and the camera scan review.
export const CYA_STRIP_BANDS = [
  { label: '0',       midpoint: 0   },
  { label: '0–30',    midpoint: 15  },
  { label: '30–50',   midpoint: 40  },
  { label: '50–100',  midpoint: 75  },
  { label: '>100',    midpoint: 110 },
]

export type RGB = [number, number, number]

interface Swatch { value: number; rgb: RGB }

const SWATCHES: Record<StripParamKey, Swatch[]> = {
  ph: [
    { value: 6.2, rgb: [242, 225, 74] },
    { value: 6.8, rgb: [240, 201, 62] },
    { value: 7.2, rgb: [240, 160, 60] },
    { value: 7.5, rgb: [232, 130, 94] },
    { value: 7.8, rgb: [224, 108, 134] },
    { value: 8.4, rgb: [196, 80, 126] },
  ],
  // Calibrated 2026-08-15 against a real AquaChek 7-Way bottle chart — the
  // previous generic pink/rose approximation was the wrong hue family
  // entirely. AquaChek's Free Chlorine reagent actually reads white → blue →
  // purple, not white → pink → magenta, which is likely why low free
  // chlorine readings were coming back near 0 regardless of the real value.
  free_chlorine: [
    { value: 0,    rgb: [206, 228, 228] },
    { value: 0.5,  rgb: [211, 222, 235] },
    { value: 1,    rgb: [178, 165, 213] },
    { value: 3,    rgb: [141, 82, 169] },
    { value: 5,    rgb: [100, 0, 115] },
    { value: 10,   rgb: [62, 1, 81] },
  ],
  // Calibrated 2026-08-15 against a real AquaChek 7-Way bottle chart
  // (extracted via pixel sampling, not eyeballed) — replaces an earlier
  // generic approximation that ran noticeably hot in the green channel
  // across the whole range, which was likely part of why TA scans were
  // landing on the wrong ppm band.
  total_alkalinity: [
    { value: 0,   rgb: [222, 157, 54] },
    { value: 40,  rgb: [180, 158, 54] },
    { value: 80,  rgb: [135, 132, 56] },
    { value: 120, rgb: [120, 138, 114] },
    { value: 180, rgb: [61, 111, 101] },
    { value: 240, rgb: [79, 115, 126] },
  ],
  cya: [
    { value: 0,   rgb: [242, 239, 216] },
    { value: 15,  rgb: [237, 226, 160] },
    { value: 40,  rgb: [232, 208, 96]  },
    { value: 75,  rgb: [217, 178, 58]  },
    { value: 110, rgb: [192, 138, 44]  },
  ],
  calcium_hardness: [
    { value: 25,   rgb: [62, 111, 168] },
    { value: 100,  rgb: [75, 143, 160] },
    { value: 250,  rgb: [95, 168, 144] },
    { value: 500,  rgb: [122, 184, 104] },
    { value: 750,  rgb: [176, 192, 96]  },
    { value: 1000, rgb: [154, 90, 158]  },
  ],
}

function srgbToLinear(c: number) {
  const cs = c / 255
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

function rgbToXyz([r, g, b]: RGB): [number, number, number] {
  const rl = srgbToLinear(r), gl = srgbToLinear(g), bl = srgbToLinear(b)
  return [
    (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) * 100,
    (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) * 100,
    (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) * 100,
  ]
}

const D65: [number, number, number] = [95.047, 100.0, 108.883]

export function rgbToLab(rgb: RGB): [number, number, number] {
  const [x, y, z] = rgbToXyz(rgb)
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x / D65[0]), fy = f(y / D65[1]), fz = f(z / D65[2])
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function deltaE(lab1: number[], lab2: number[]) {
  return Math.sqrt((lab1[0] - lab2[0]) ** 2 + (lab1[1] - lab2[1]) ** 2 + (lab1[2] - lab2[2]) ** 2)
}

// Corrects for ambient lighting/white-balance drift by scaling the sampled
// pad color against a patch of the strip's own (assumed near-white) plastic.
export function whiteBalance(rgb: RGB, referenceWhite: RGB): RGB {
  const target = 235
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const gain = (c: number) => target / Math.max(c, 30)
  return [
    clamp(rgb[0] * gain(referenceWhite[0])),
    clamp(rgb[1] * gain(referenceWhite[1])),
    clamp(rgb[2] * gain(referenceWhite[2])),
  ]
}

export interface MatchResult { value: number; confidence: number }

// Finds the two nearest reference swatches (by Lab distance) and takes a
// distance-weighted average between them, so a color between two printed
// bands still produces a reasonable in-between reading rather than snapping
// to the nearest band.
export function matchSwatch(key: StripParamKey, rgb: RGB): MatchResult {
  const swatches = SWATCHES[key]
  const lab = rgbToLab(rgb)
  const ranked = swatches
    .map(s => ({ s, d: deltaE(lab, rgbToLab(s.rgb)) }))
    .sort((a, b) => a.d - b.d)
  const [best, second] = ranked
  const confidence = Math.max(0, Math.min(1, 1 - best.d / 35))
  if (!second || best.d < 0.01) return { value: best.s.value, confidence }
  const w1 = 1 / Math.max(best.d, 0.01)
  const w2 = 1 / Math.max(second.d, 0.01)
  const value = (best.s.value * w1 + second.s.value * w2) / (w1 + w2)
  return { value, confidence }
}

export interface PinPosition { x: number; y: number } // fractional 0..1 within the photo

export type PinKey = StripParamKey | 'white_reference'

export type StripBrand = 'aquachek_7way' | 'taylor' | 'generic'

// Sampling points assume the strip is laid with pads in a horizontal row,
// centered in the photo — matches the framing guidance shown before the user
// takes the photo. No manual placement step; this is the starting guess the
// slider-based review lets the user correct. Pad order/spacing is brand-
// specific, which is why this is keyed by brand rather than a single fixed
// layout — a wrong-brand guess samples the wrong physical pad entirely.
export const PIN_LAYOUTS: Record<StripBrand, Record<PinKey, PinPosition>> = {
  // Confirmed against a real AquaChek 7-Way strip (2026-08-12): pad order
  // left-to-right is Hardness, Total Chlorine, Free Chlorine, pH, Total
  // Alkalinity, CYA. Total Chlorine isn't a field PoolKeep tracks, so its
  // position (index 2 of 6) is skipped rather than sampled.
  aquachek_7way: {
    calcium_hardness:   { x: 0.20, y: 0.30 },
    free_chlorine:      { x: 0.44, y: 0.30 },
    ph:                 { x: 0.56, y: 0.30 },
    total_alkalinity:   { x: 0.68, y: 0.30 },
    cya:                { x: 0.80, y: 0.30 },
    white_reference:    { x: 0.56, y: 0.70 },
  },
  // Sourced from Taylor's official "how to read" guide (2026-08-15): pad
  // order is Free Chlorine, Total Chlorine/Bromine, pH, Total Alkalinity,
  // Total Hardness, CYA. Total Chlorine/Bromine isn't a field PoolKeep
  // tracks, so its position (index 2 of 6) is skipped rather than sampled.
  // Not verified against a physical strip the way AquaChek 7-Way was — if a
  // Taylor user reports readings are off, re-check this against a real strip
  // before assuming the color-matching itself is at fault.
  taylor: {
    free_chlorine:      { x: 0.20, y: 0.30 },
    ph:                 { x: 0.44, y: 0.30 },
    total_alkalinity:   { x: 0.56, y: 0.30 },
    calcium_hardness:   { x: 0.68, y: 0.30 },
    cya:                { x: 0.80, y: 0.30 },
    white_reference:    { x: 0.50, y: 0.70 },
  },
  // Fallback for brands we don't have confirmed pad positions for yet.
  generic: {
    ph:                 { x: 0.30, y: 0.30 },
    free_chlorine:      { x: 0.42, y: 0.30 },
    total_alkalinity:   { x: 0.54, y: 0.30 },
    cya:                { x: 0.66, y: 0.30 },
    calcium_hardness:   { x: 0.78, y: 0.30 },
    white_reference:    { x: 0.54, y: 0.70 },
  },
}

export function pinsForBrand(stripBrand: string | null | undefined): Record<PinKey, PinPosition> {
  if (stripBrand === 'aquachek_7way') return PIN_LAYOUTS.aquachek_7way
  if (stripBrand === 'taylor') return PIN_LAYOUTS.taylor
  return PIN_LAYOUTS.generic
}
