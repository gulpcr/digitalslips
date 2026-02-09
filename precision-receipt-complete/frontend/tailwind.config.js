/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors - Meezan Bank (Deep Purple + Green-Teal + Gold)
        primary: {
          DEFAULT: '#5F2585',  // Deep Purple
          50: '#F3EDF7',
          100: '#E7DBEF',
          200: '#CFB7DF',
          300: '#B793CF',
          400: '#9F6FBF',
          500: '#5F2585',  // Main
          600: '#4C1E6A',
          700: '#391650',
          800: '#260F35',
          900: '#13071B',
        },
        accent: {
          DEFAULT: '#2A7A5F',  // Green-Teal
          50: '#EAF5F1',
          100: '#D5EBE3',
          200: '#ABD7C7',
          300: '#81C3AB',
          400: '#57AF8F',
          500: '#2A7A5F',  // Main
          600: '#22624C',
          700: '#194939',
          800: '#113126',
          900: '#081813',
        },
        gold: {
          DEFAULT: '#D4AF37',
          50: '#FBF6E7',
          100: '#F7EDCF',
          500: '#D4AF37',
          600: '#B8962E',
          700: '#9C7D25',
        },
        background: {
          light: '#F6F6F6',  // App background
        },
        surface: {
          DEFAULT: '#FFFFFF',  // Cards, modals
        },
        text: {
          primary: '#212121',    // Main text
          secondary: '#6B6B6B',  // Secondary text
        },
        border: {
          DEFAULT: '#E0E0E0',
        },
        // Status Colors - NO CHANGE
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
        sans: ['Open Sans', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      },
      fontSize: {
        // Typography Scale
        'body': ['16px', { lineHeight: '1.6' }],
        'body-sm': ['14px', { lineHeight: '1.6' }],
        'body-lg': ['18px', { lineHeight: '1.6' }],
      },
      borderRadius: {
        'button': '6px',
        'card': '6px',
        'input': '4px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.08)',
        'input-focus': '0 0 0 3px rgba(95, 37, 133, 0.1)',
      },
      spacing: {
        'card-padding': '16px',
        'card-padding-lg': '24px',
      },
    },
  },
  plugins: [],
}
