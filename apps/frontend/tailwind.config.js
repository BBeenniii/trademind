/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        panel: '#11151c',
        panelSoft: '#171c24',
        line: '#26303d',
        ink: '#e7edf5',
        muted: '#8d9aab',
        buy: '#38d39f',
        sell: '#ff6876',
        hold: '#f3b852'
      }
    }
  },
  plugins: []
};