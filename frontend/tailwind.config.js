/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  important: '#root',
  theme: {
    extend: {
      fontFamily: {
        heading: ["Manrope", "Segoe UI", "sans-serif"],
        clinical: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
      },
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
        confidence: {
          high: '#2e7d32',
          moderate: '#f9a825',
          low: '#c62828',
        },
        severity: {
          major: '#c62828',
          majorLight: '#ffebee',
          moderate: '#ef6c00',
          moderateLight: '#fff3e0',
          minor: '#1976d2',
          minorLight: '#e3f2fd',
        },
        evidence: {
          gradeA: '#1b5e20',
          gradeB: '#33691e',
          gradeC: '#827717',
          gradeD: '#f57f17',
          expert: '#616161',
        },
        agent: {
          pending: '#757575',
          running: '#1976d2',
          completed: '#2e7d32',
          error: '#c62828',
        },
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'clinical': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'clinical-hover': '0 4px 12px rgba(0, 0, 0, 0.12)',
        'alert-major': '0 4px 16px rgba(198, 40, 40, 0.24)',
        'alert-moderate': '0 4px 16px rgba(239, 108, 0, 0.24)',
        'alert-minor': '0 4px 16px rgba(25, 118, 210, 0.24)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-clinical': 'pulseClinical 2s ease-in-out infinite',
        'progress-shimmer': 'progressShimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseClinical: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        progressShimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
