/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a0e1a',
          800: '#0f1629',
          700: '#1a2540',
        }
      },
      animation: {
        'slide-up':   'slideUp 0.3s ease-out both',
        'fade-in':    'fadeIn 0.25s ease-out both',
        'scale-in':   'scaleIn 0.2s ease-out both',
      },
      keyframes: {
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)'    },
        },
      },
    }
  },
  plugins: []
}
