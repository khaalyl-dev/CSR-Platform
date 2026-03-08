/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Instrument Sans', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          900: '#1B3C53',
          800: '#234C6A',
          700: '#456882',
          100: '#E3E3E3',
        }
      }
    }
  },
  plugins: []
};
