/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pujo: {
          dark: '#0f1218',
          card: '#171b24',
          gold: '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}
