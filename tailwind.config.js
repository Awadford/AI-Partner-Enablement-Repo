/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pendo: {
          pink: '#CC0066',
          'pink-dark': '#a30052',
          'pink-light': '#ff1a80',
          navy: '#1B1B4B',
          'navy-light': '#2d2d6b',
        }
      }
    },
  },
  plugins: [],
}
