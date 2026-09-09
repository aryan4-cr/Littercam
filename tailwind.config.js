/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#0f172a',       // Slate 900
          darkblue: '#1e293b',   // Slate 800
          blue: '#1e3a8a',       // Blue 900
          accent: '#2563eb',     // Blue 600
          lightbg: '#f8fafc',    // Slate 50
          card: '#ffffff',
          border: '#cbd5e1',     // Slate 300
          emerald: '#065f46',    // Emerald 800
          emeraldlight: '#d1fae5'// Emerald 100
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
