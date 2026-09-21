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
  { key: 'cya',              label: 'Cyanuric Acid (CYA)', unit: 'ppm', decimals: 0, min: 0,   max: 300,  step: 5 },
  { key: 'calcium_hardness', label: 'Water Hardness',      unit: 'ppm', decimals: 0, min: 0,   max: 1000, step: 25 },
]

// AquaChek 7-Way strip CYA color bands → stored as midpoint ppm. Most
// consumer strips only distinguish bands for CYA, not a precise number, so
// this is offered as an alternative to typing/sliding an exact value —
// shared between the manual entry form and the camera scan review.
// Calibrated 2026-08-15 against a real AquaChek 7-Way bottle chart — the
// previous bands (0/0-30/30-50/50-100/>100) and their 110 ppm ceiling were
// invented, not from a real product; the actual printed chart's tested
// points are 0, 30-50, 100, 150, 300.
export const CYA_STRIP_BANDS = [
  { label: '0',       midpoint: 0   },
  { label: '30–50',   midpoint: 40  },
  { label: '100',     midpoint: 100 },
  { label: '150',     midpoint: 150 },
  { label: '300',     midpoint: 300 },
]

export type RGB = [number, number, number]

interface Swatch { value: number; rgb: RGB }

// Reference colors for each param, ordered low → high, in the same white-
// balanced space scans are matched in.
//
// Rebuilt 2026-09-20 from five photos of the real AquaChek 7-Way bottle
// chart under different lighting (plus the strip-beside-bottle shots), each
// normalized against its own label paper (the brightest ~6% of the label)
// exactly like scans are normalized against the strip's plastic, then
// averaged. The earlier tables were sampled from raw, un-normalized photos,
// and were then patched with one-off "anchor" points taken from individual
// scans — but those anchors were themselves sampled through a white-balance
// bug (the white reference was landing on the background), so each patch
// fixed one photo and broke the next. Those anchors are removed.
//
// Brightness of the same swatch varies a lot between photos (exposure and
// tone curve), while hue/chroma stay put — e.g. TA 0→240 ppm runs hue
// 81° → 100° → 109° → 142° → 178° → 222° in every photo. matchSwatch()
// therefore leans on hue/chroma and barely on brightness.
const SWATCHES: Record<StripParamKey, Swatch[]> = {
  ph: [
    { value: 6.2, rgb: [224, 152, 62] },
    { value: 6.8, rgb: [228, 118, 35] },
    { value: 7.2, rgb: [213, 78, 5] },
    { value: 7.8, rgb: [216, 87, 81] },
    { value: 8.4, rgb: [210, 25, 65] },
  ],
  free_chlorine: [
    { value: 0,   rgb: [226, 232, 213] },
    { value: 0.5, rgb: [218, 212, 192] },
    { value: 1,   rgb: [223, 208, 212] },
    { value: 3,   rgb: [198, 163, 216] },
    { value: 5,   rgb: [172, 111, 192] },
    { value: 10,  rgb: [147, 53, 153] },
  ],
  total_alkalinity: [
    { value: 0,   rgb: [195, 144, 30] },
    { value: 40,  rgb: [153, 145, 42] },
    { value: 80,  rgb: [116, 126, 38] },
    { value: 120, rgb: [106, 129, 105] },
    { value: 180, rgb: [45, 105, 93] },
    { value: 240, rgb: [60, 96, 105] },
  ],
  cya: [
    { value: 0,   rgb: [183, 129, 25] },
    { value: 40,  rgb: [175, 89, 2] },
    { value: 100, rgb: [167, 44, 53] },
    { value: 150, rgb: [136, 14, 69] },
    { value: 300, rgb: [119, 16, 93] },
  ],
  calcium_hardness: [
    { value: 0,    rgb: [66, 83, 128] },
    { value: 100,  rgb: [97, 93, 141] },
    { value: 250,  rgb: [103, 74, 126] },
    { value: 500,  rgb: [126, 64, 99] },
    { value: 1000, rgb: [156, 69, 108] },
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

// Corrects for ambient lighting/white-balance drift by scaling the sampled
// pad color against a patch of the strip's own (assumed near-white) plastic.
export function whiteBalance(rgb: RGB, referenceWhite: RGB): RGB {
  const target = 235
  // Only clamp below zero: a saturated pad (a red pH pad next to dimly lit
  // plastic) legitimately lands above 255 once the plastic is normalized to
  // 235, and clipping it flattens exactly the hue we match on. Callers that
  // paint the color (CSS rgb()) clamp on their own.
  const floor = (v: number) => Math.max(0, v)
  const gain = (c: number) => target / Math.max(c, 30)
  return [
    floor(rgb[0] * gain(referenceWhite[0])),
    floor(rgb[1] * gain(referenceWhite[1])),
    floor(rgb[2] * gain(referenceWhite[2])),
  ]
}

export interface MatchResult { value: number; confidence: number }

// Brightness counts for far less than hue/chroma. The same pad photographs
// at very different lightness depending on exposure, tone curve and shadow
// (the same TA swatch varies ~2x in brightness across three chart photos)
// while its a*/b* barely move.
const L_WEIGHT = 0.3

// Distance (in the weighted space) at which confidence hits zero. Correctly
// matched real pads land roughly 5-30 away — printed chart swatches and
// real reagent pads never match exactly — while a background pixel or the
// wrong pad lands well past 50.
const CONFIDENCE_DISTANCE = 50

type Vec3 = [number, number, number]

function feature(rgb: RGB): Vec3 {
  const [L, a, b] = rgbToLab(rgb)
  return [L * L_WEIGHT, a, b]
}

export interface ScaleLocation { value: number; distance: number; segment: [number, number] }

// Finds where a color sits along a param's reference scale: the closest point
// on the polyline through the swatches (ordered low → high). Reading along
// the scale instead of averaging the two nearest swatches by color means the
// result is always between two ADJACENT chart values — never a blend of
// swatches from opposite ends of the scale that happen to share a color.
export function locateOnScale(key: StripParamKey, rgb: RGB): ScaleLocation {
  const swatches = SWATCHES[key]
  const p = feature(rgb)
  let best: ScaleLocation | null = null
  for (let i = 0; i < swatches.length - 1; i++) {
    const a = feature(swatches[i].rgb)
    const b = feature(swatches[i + 1].rgb)
    const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ap: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
    const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2))
    const dx = p[0] - (a[0] + ab[0] * t)
    const dy = p[1] - (a[1] + ab[1] * t)
    const dz = p[2] - (a[2] + ab[2] * t)
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (!best || distance < best.distance) {
      best = {
        value: swatches[i].value + (swatches[i + 1].value - swatches[i].value) * t,
        distance,
        segment: [swatches[i].value, swatches[i + 1].value],
      }
    }
  }
  return best as ScaleLocation
}

export function matchSwatch(key: StripParamKey, rgb: RGB): MatchResult {
  const { value, distance } = locateOnScale(key, rgb)
  return { value, confidence: Math.max(0, Math.min(1, 1 - distance / CONFIDENCE_DISTANCE)) }
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
  // Re-verified 2026-08-16 by pixel-sampling two real, properly-framed flat
  // strip photos (the 2026-08-12 values were sampled from a differently-
  // framed reference photo and turned out not to generalize — pads sat far
  // left of these fractions and much lower than y=0.30 in real photos, plus
  // any slight tilt in laying the strip down drifts pad y across the strip's
  // width). Pad order left-to-right is Hardness, Total Chlorine, Free
  // Chlorine, pH, Total Alkalinity, CYA. Total Chlorine isn't a field
  // PoolKeep tracks, so its position (index 2 of 6) is skipped rather than
  // sampled. These are starting points only now — ScanStrip.tsx searches a
  // neighborhood around each and keeps whichever point best matches the
  // param's own swatches, so exact precision here matters less than it used to.
  aquachek_7way: {
    calcium_hardness:   { x: 0.10, y: 0.55 },
    free_chlorine:      { x: 0.33, y: 0.55 },
    ph:                 { x: 0.45, y: 0.56 },
    total_alkalinity:   { x: 0.57, y: 0.57 },
    cya:                { x: 0.70, y: 0.58 },
    white_reference:    { x: 0.85, y: 0.58 },
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

// Left-to-right pad order for the "how to lay out your strip" reference
// diagram shown before the camera opens — includes pads PoolKeep doesn't
// track (tracked: false) so the diagram matches the real physical strip
// the user is holding, not just the subset we sample.
export interface StripPadInfo { label: string; tracked: boolean; key?: StripParamKey }
export const STRIP_BRAND_LAYOUT: Record<StripBrand, StripPadInfo[]> = {
  aquachek_7way: [
    { label: 'Hardness',    tracked: true, key: 'calcium_hardness' },
    { label: 'Total Cl',    tracked: false },
    { label: 'Free Cl',     tracked: true, key: 'free_chlorine' },
    { label: 'pH',          tracked: true, key: 'ph' },
    { label: 'Alkalinity',  tracked: true, key: 'total_alkalinity' },
    { label: 'CYA',         tracked: true, key: 'cya' },
  ],
  taylor: [
    { label: 'Free Cl',     tracked: true, key: 'free_chlorine' },
    { label: 'Total Cl/Br', tracked: false },
    { label: 'pH',          tracked: true, key: 'ph' },
    { label: 'Alkalinity',  tracked: true, key: 'total_alkalinity' },
    { label: 'Hardness',    tracked: true, key: 'calcium_hardness' },
    { label: 'CYA',         tracked: true, key: 'cya' },
  ],
  generic: [
    { label: 'pH',          tracked: true, key: 'ph' },
    { label: 'Free Cl',     tracked: true, key: 'free_chlorine' },
    { label: 'Alkalinity',  tracked: true, key: 'total_alkalinity' },
    { label: 'CYA',         tracked: true, key: 'cya' },
    { label: 'Hardness',    tracked: true, key: 'calcium_hardness' },
  ],
}
export function stripLayoutForBrand(stripBrand: string | null | undefined): StripPadInfo[] {
  if (stripBrand === 'aquachek_7way') return STRIP_BRAND_LAYOUT.aquachek_7way
  if (stripBrand === 'taylor') return STRIP_BRAND_LAYOUT.taylor
  return STRIP_BRAND_LAYOUT.generic
}

export function pinsForBrand(stripBrand: string | null | undefined): Record<PinKey, PinPosition> {
  if (stripBrand === 'aquachek_7way') return PIN_LAYOUTS.aquachek_7way
  if (stripBrand === 'taylor') return PIN_LAYOUTS.taylor
  return PIN_LAYOUTS.generic
}

