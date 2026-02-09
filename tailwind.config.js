/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors - Navy + Cyan Palette
        primary: {
          DEFAULT: '#0B1F3B',  // Brand Navy
          50: '#E8EBF0',
          100: '#D1D8E1',
          200: '#A3B1C3',
          300: '#758AA5',
          400: '#476387',
          500: '#0B1F3B',  // Main
          600: '#09192F',
          700: '#071323',
          800: '#040C17',
          900: '#02060C',
        },
        accent: {
          DEFAULT: '#00A7FF',  // Electric Cyan
          50: '#E6F6FF',
          100: '#CCEDFF',
          200: '#99DBFF',
          300: '#66C9FF',
          400: '#33B7FF',
          500: '#00A7FF',  // Main
          600: '#0086CC',
          700: '#006499',
          800: '#004366',
          900: '#002133',
        },
        background: {
          light: '#F6F8FB',  // App background
        },
        surface: {
          DEFAULT: '#FFFFFF',  // Cards, modals
        },
        text: {
          primary: '#0F172A',    // Main text
          secondary: '#475569',  // Secondary text
        },
        border: {
          DEFAULT: '#E2E8F0',
        },
        // Status Colors
        success: {
          DEFAULT: '#16A34A',
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#16A34A',
          600: '#15803D',
          700: '#166534',
        },
        warning: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        error: {
          DEFAULT: '#DC2626',
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#DC2626',
          600: '#B91C1C',
          700: '#991B1B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Typography Scale
        'body': ['16px', { lineHeight: '1.6' }],
        'body-sm': ['14px', { lineHeight: '1.6' }],
        'body-lg': ['18px', { lineHeight: '1.6' }],
      },
      borderRadius: {
        'button': '8px',
        'card': '12px',
        'input': '6px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(11, 31, 59, 0.05), 0 1px 2px -1px rgba(11, 31, 59, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(11, 31, 59, 0.08), 0 2px 4px -2px rgba(11, 31, 59, 0.08)',
        'input-focus': '0 0 0 3px rgba(0, 167, 255, 0.1)',
      },
      spacing: {
        'card-padding': '16px',
        'card-padding-lg': '24px',
      },
    },
  },
  plugins: [],
}
