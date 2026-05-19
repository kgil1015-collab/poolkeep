import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'pool-deep':    '#003D5C',
        'pool-blue':    '#00A8F0',
        'pool-dark':    '#0078B8',
        'teal':         '#00E0B0',
        'surface':      '#F0F6FA',
        'text-primary': '#0D2333',
        'text-muted':   '#4A6A7C',
        'text-faint':   '#8AAABB',
        'success':      '#1DB869',
        'warning':      '#F5A623',
        'danger':       '#E5304A',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}

export default config
