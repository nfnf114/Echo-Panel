/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#e53e3e',
          'red-dark': '#c53030',
          'red-glow': '#fc8181',
        },
        dark: {
          900: '#0a0a0b',
          800: '#111113',
          750: '#141417',
          700: '#1a1a1f',
          600: '#212128',
          500: '#2a2a35',
          400: '#353545',
        },
        accent: {
          blue: '#3b82f6',
          green: '#22c55e',
          yellow: '#eab308',
          orange: '#f97316',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(229, 62, 62, 0.3)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { transform: 'translateX(-10px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
      }
    },
  },
  plugins: [],
}
