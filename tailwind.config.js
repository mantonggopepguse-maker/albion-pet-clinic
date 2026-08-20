/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070C1A',
          900: '#0F172A',
          800: '#1C2541',
          700: '#1E293B',
          600: '#334155',
          500: '#475569',
          100: '#F1F5F9',
          50: '#F8FAFC',
        },
        gold: {
          700: '#92400E',
          600: '#B45309',
          500: '#D97706',
          400: '#F59E0B',
          300: '#FCD34D',
          200: '#FDE68A',
          100: '#FEF3C7',
          50: '#FFFBEB',
        },
        glass: {
          surface: 'rgba(255, 255, 255, 0.76)',
          border: 'rgba(255, 255, 255, 0.65)',
          dark: 'rgba(15, 23, 42, 0.88)',
          gold: 'rgba(217, 119, 6, 0.15)',
        },
        peach: {
          50: '#fff5f2',
          100: '#ffe6de',
          200: '#ffcaba',
          300: '#ffaa91',
          400: '#ff8563',
          500: '#ff6035',
          600: '#ed4618',
          700: '#c6330d',
          800: '#a42a0e',
          900: '#882611',
        }
      },
      fontFamily: {
        heading: ['Outfit', 'Public Sans', 'sans-serif'],
        sans: ['Public Sans', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'glass-glow': 'glassGlow 4s infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glassGlow: {
          '0%': { boxShadow: '0 8px 32px 0 rgba(15, 23, 42, 0.08)' },
          '100%': { boxShadow: '0 8px 32px 0 rgba(217, 119, 6, 0.18)' },
        },
      },
    },
  },
  plugins: [],
}
