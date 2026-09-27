/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          navy: '#0f172a',
          slate: '#f8fafc',
          panel: '#ffffff',
          border: '#e2e8f0',
          blue: '#0284c7',
          'blue-dark': '#0369a1',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
