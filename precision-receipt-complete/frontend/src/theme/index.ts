/**
 * Design System Theme Tokens
 * Precision Receipt - Meezan Bank
 *
 * Brand Personality: Meezan Bank corporate identity
 * Deep Purple + Green-Teal + Gold palette
 */

export const theme = {
  // Color System
  colors: {
    // Primary (Deep Purple)
    primary: {
      DEFAULT: '#5F2585',
      50: '#F3EDF7',
      100: '#E7DBEF',
      200: '#CFB7DF',
      300: '#B793CF',
      400: '#9F6FBF',
      500: '#5F2585',
      600: '#4C1E6A',
      700: '#391650',
      800: '#260F35',
      900: '#13071B',
    },
    // Accent (Green-Teal)
    accent: {
      DEFAULT: '#2A7A5F',
      50: '#EAF5F1',
      100: '#D5EBE3',
      200: '#ABD7C7',
      300: '#81C3AB',
      400: '#57AF8F',
      500: '#2A7A5F',
      600: '#22624C',
      700: '#194939',
      800: '#113126',
      900: '#081813',
    },
    // Gold
    gold: {
      DEFAULT: '#D4AF37',
      50: '#FBF6E7',
      100: '#F7EDCF',
      500: '#D4AF37',
      600: '#B8962E',
      700: '#9C7D25',
    },
    // Backgrounds
    background: {
      light: '#F6F6F6',
      surface: '#FFFFFF',
    },
    // Text
    text: {
      primary: '#212121',
      secondary: '#6B6B6B',
    },
    // Border
    border: {
      DEFAULT: '#E0E0E0',
    },
    // Status - NO CHANGE
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

  // Typography
  typography: {
    fontFamily: {
      sans: ['Open Sans', 'system-ui', '-apple-system', 'sans-serif'],
      serif: ['Merriweather', 'Georgia', 'serif'],
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px',
      '5xl': '48px',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.6',
    },
  },

  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px',
    '4xl': '64px',
    cardPadding: '16px',
    cardPaddingLg: '24px',
  },

  // Border Radius
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '6px',
    xl: '8px',
    button: '6px',
    card: '6px',
    input: '4px',
  },

  // Shadows
  boxShadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
    lg: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.08)',
    xl: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
    cardHover: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.08)',
    inputFocus: '0 0 0 3px rgba(95, 37, 133, 0.1)',
  },

  // Transitions
  transition: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Z-Index
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
} as const;

export type Theme = typeof theme;

// Helper function to get theme values
export const getThemeValue = (path: string): any => {
  const keys = path.split('.');
  let value: any = theme;

  for (const key of keys) {
    value = value[key];
    if (value === undefined) return undefined;
  }

  return value;
};

// CSS Custom Properties Generator
export const generateCSSVariables = (): string => {
  return `
    :root {
      /* Colors - Primary */
      --color-primary: ${theme.colors.primary.DEFAULT};
      --color-primary-500: ${theme.colors.primary[500]};

      /* Colors - Accent */
      --color-accent: ${theme.colors.accent.DEFAULT};
      --color-accent-500: ${theme.colors.accent[500]};

      /* Colors - Gold */
      --color-gold: ${theme.colors.gold.DEFAULT};

      /* Colors - Background */
      --color-bg-light: ${theme.colors.background.light};
      --color-bg-surface: ${theme.colors.background.surface};

      /* Colors - Text */
      --color-text-primary: ${theme.colors.text.primary};
      --color-text-secondary: ${theme.colors.text.secondary};

      /* Colors - Border */
      --color-border: ${theme.colors.border.DEFAULT};

      /* Colors - Status */
      --color-success: ${theme.colors.success.DEFAULT};
      --color-warning: ${theme.colors.warning.DEFAULT};
      --color-error: ${theme.colors.error.DEFAULT};

      /* Typography */
      --font-sans: ${theme.typography.fontFamily.sans.join(', ')};
      --font-serif: ${theme.typography.fontFamily.serif.join(', ')};
      --font-size-base: ${theme.typography.fontSize.base};
      --line-height-normal: ${theme.typography.lineHeight.normal};

      /* Spacing */
      --spacing-card: ${theme.spacing.cardPadding};
      --spacing-card-lg: ${theme.spacing.cardPaddingLg};

      /* Border Radius */
      --radius-button: ${theme.borderRadius.button};
      --radius-card: ${theme.borderRadius.card};
      --radius-input: ${theme.borderRadius.input};

      /* Transitions */
      --transition-base: ${theme.transition.base};
    }
  `;
};

export default theme;
