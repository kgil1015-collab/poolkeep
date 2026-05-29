'use client'

/**
 * Animated triple-layer wave divider.
 * Drop-in replacement for the static wave SVG used between every page header and body.
 *
 * Usage:
 *   <WaveDivider />               ← standard
 *   <WaveDivider className="no-print" />  ← share page (print override)
 */
export default function WaveDivider({
  fill = '#F0F6FA',
  className = '',
}: {
  fill?: string
  className?: string
}) {
  return (
    <div
      className={`bg-pool-deep ${className}`}
      style={{ height: 52, position: 'relative', overflow: 'hidden' }}
    >
      {/* Back wave — fastest, most transparent, slight phase offset */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 960 52"
        preserveAspectRatio="none"
        style={{
          position: 'absolute', bottom: 0,
          width: '200%', height: '100%',
          animation: 'waveScroll 5s linear infinite',
        }}
      >
        <path
          d="M0,38 Q120,20 240,38 Q360,56 480,38 Q600,20 720,38 Q840,56 960,38 L960,52 L0,52 Z"
          fill={fill}
          opacity="0.3"
        />
      </svg>

      {/* Mid wave — medium speed, reversed direction */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 960 52"
        preserveAspectRatio="none"
        style={{
          position: 'absolute', bottom: 0,
          width: '200%', height: '100%',
          animation: 'waveScroll 8s linear infinite reverse',
        }}
      >
        <path
          d="M0,32 Q120,14 240,34 Q360,54 480,32 Q600,10 720,34 Q840,56 960,30 L960,52 L0,52 Z"
          fill={fill}
          opacity="0.55"
        />
      </svg>

      {/* Front wave — slowest, fully opaque — defines the hard color edge */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 960 52"
        preserveAspectRatio="none"
        style={{
          position: 'absolute', bottom: 0,
          width: '200%', height: '100%',
          animation: 'waveScroll 12s linear infinite',
        }}
      >
        <path
          d="M0,36 Q120,16 240,36 Q360,56 480,36 Q600,16 720,36 Q840,56 960,36 L960,52 L0,52 Z"
          fill={fill}
        />
      </svg>
    </div>
  )
}
