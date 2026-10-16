/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['Outfit', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        pujo: {
          dark: '#07090e',
          surface: '#0f1422',
          card: '#141a2b',
          border: 'rgba(255, 255, 255, 0.1)',
          gold: '#f59e0b',
          amber: '#fbbf24',
        }
      },
      boxShadow: {
        'gold-glow': '0 0 25px -4px rgba(245, 158, 11, 0.45)',
        'emerald-glow': '0 0 25px -4px rgba(16, 185, 129, 0.45)',
        'rose-glow': '0 0 25px -4px rgba(244, 63, 94, 0.45)',
      }
    },
  },
  plugins: [],
}
