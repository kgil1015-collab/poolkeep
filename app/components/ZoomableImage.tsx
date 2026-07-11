'use client'

import { useRef, useState } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 4
const DOUBLE_TAP_ZOOM = 2.5
const DOUBLE_TAP_WINDOW_MS = 300

// Pinch/pan/double-tap zoom for a photo that stays inline in its own fixed-
// height box (not a full-screen overlay) — lets you inspect detail without
// losing whatever else is on screen around it.
export default function ZoomableImage({ src, alt, height }: { src: string; alt: string; height: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [animating, setAnimating] = useState(false)

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStart = useRef<{ dist: number; scale: number; midX: number; midY: number; tx: number; ty: number } | null>(null)
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const lastTapAt = useRef(0)

  function clamp(newScale: number, newTx: number, newTy: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { tx: newTx, ty: newTy }
    const maxX = (rect.width * (newScale - 1)) / 2
    const maxY = (rect.height * (newScale - 1)) / 2
    return {
      tx: Math.max(-maxX, Math.min(maxX, newTx)),
      ty: Math.max(-maxY, Math.min(maxY, newTy)),
    }
  }

  function resetZoom() {
    setAnimating(true)
    setScale(1); setTx(0); setTy(0)
    setTimeout(() => setAnimating(false), 200)
  }

  function zoomAtPoint(clientX: number, clientY: number, targetScale: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) { setScale(targetScale); return }
    const anchorX = clientX - rect.left - rect.width / 2
    const anchorY = clientY - rect.top - rect.height / 2
    const ratio = targetScale / scale
    const next = clamp(targetScale, anchorX - (anchorX - tx) * ratio, anchorY - (anchorY - ty) * ratio)
    setAnimating(true)
    setScale(targetScale); setTx(next.tx); setTy(next.ty)
    setTimeout(() => setAnimating(false), 200)
  }

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      pinchStart.current = { dist, scale, midX: (pts[0].x + pts[1].x) / 2, midY: (pts[0].y + pts[1].y) / 2, tx, ty }
      panStart.current = null
    } else if (pointers.current.size === 1) {
      const now = Date.now()
      if (now - lastTapAt.current < DOUBLE_TAP_WINDOW_MS) {
        lastTapAt.current = 0
        if (scale > 1) resetZoom()
        else zoomAtPoint(e.clientX, e.clientY, DOUBLE_TAP_ZOOM)
      } else {
        lastTapAt.current = now
      }
      panStart.current = { x: e.clientX, y: e.clientY, tx, ty }
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = Array.from(pointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStart.current.scale * (dist / pinchStart.current.dist)))
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const anchorX = pinchStart.current.midX - rect.left - rect.width / 2
        const anchorY = pinchStart.current.midY - rect.top - rect.height / 2
        const ratio = newScale / pinchStart.current.scale
        const next = clamp(newScale, anchorX - (anchorX - pinchStart.current.tx) * ratio, anchorY - (anchorY - pinchStart.current.ty) * ratio)
        setTx(next.tx); setTy(next.ty)
      }
      setScale(newScale)
    } else if (pointers.current.size === 1 && panStart.current && scale > 1) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      const next = clamp(scale, panStart.current.tx + dx, panStart.current.ty + dy)
      setTx(next.tx); setTy(next.ty)
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 1) {
      const [, p] = Array.from(pointers.current.entries())[0]
      panStart.current = { x: p.x, y: p.y, tx, ty }
    } else {
      panStart.current = null
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden bg-black"
      style={{ height, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain select-none"
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transition: animating ? 'transform 0.2s ease-out' : 'none',
        }}
      />
      {scale === 1 && (
        <span className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-semibold text-white px-2 py-1 rounded-full pointer-events-none" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          Pinch to zoom
        </span>
      )}
    </div>
  )
}
