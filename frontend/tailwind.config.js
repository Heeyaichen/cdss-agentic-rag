/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  important: '#root',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#2196f3',
          600: '#1e88e5',
          700: '#1976d2',
          800: '#1565c0',
          900: '#0d47a1',
        },
        clinical: {
          critical: '#d32f2f',
          warning: '#f57c00',
          info: '#0288d1',
          success: '#388e3c',
        },
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
