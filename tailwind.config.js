/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        orion: {
          bg: '#0a0a0f',
          surface: '#12121a',
          panel: '#1a1a26',
          border: '#2a2a3e',
          accent: '#7c3aed',
          'accent-light': '#a78bfa',
          highlight: '#f59e0b',
          text: '#e2e8f0',
          muted: '#64748b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      }
    }
  },
  plugins: []
}
