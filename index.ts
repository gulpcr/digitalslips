/**
 * Design System Theme Tokens
 * Precision Receipt - Meezan Bank
 * 
 * Brand Personality: Modern enterprise AI product
 * Clean layouts, generous whitespace, minimal visual noise
 */

export const theme = {
  // Color System
  colors: {
    // Primary (Brand Navy)
    primary: {
      DEFAULT: '#0B1F3B',
      50: '#E8EBF0',
      100: '#D1D8E1',
      200: '#A3B1C3',
      300: '#758AA5',
      400: '#476387',
      500: '#0B1F3B',
      600: '#09192F',
      700: '#071323',
      800: '#040C17',
      900: '#02060C',
    },
    // Accent (Electric Cyan)
    accent: {
      DEFAULT: '#00A7FF',
      50: '#E6F6FF',
      100: '#CCEDFF',
      200: '#99DBFF',
      300: '#66C9FF',
      400: '#33B7FF',
      500: '#00A7FF',
      600: '#0086CC',
      700: '#006499',
      800: '#004366',
      900: '#002133',
    },
    // Backgrounds
    background: {
      light: '#F6F8FB',
      surface: '#FFFFFF',
    },
    // Text
    text: {
      primary: '#0F172A',
      secondary: '#475569',
    },
    // Border
    border: {
      DEFAULT: '#E2E8F0',
    },
    // Status
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
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
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
    lg: '8px',
    xl: '12px',
    button: '8px',
    card: '12px',
    input: '6px',
  },

  // Shadows
  boxShadow: {
    sm: '0 1px 2px 0 rgba(11, 31, 59, 0.05)',
    md: '0 1px 3px 0 rgba(11, 31, 59, 0.05), 0 1px 2px -1px rgba(11, 31, 59, 0.05)',
    lg: '0 4px 6px -1px rgba(11, 31, 59, 0.08), 0 2px 4px -2px rgba(11, 31, 59, 0.08)',
    xl: '0 10px 15px -3px rgba(11, 31, 59, 0.1), 0 4px 6px -4px rgba(11, 31, 59, 0.1)',
    card: '0 1px 3px 0 rgba(11, 31, 59, 0.05), 0 1px 2px -1px rgba(11, 31, 59, 0.05)',
    cardHover: '0 4px 6px -1px rgba(11, 31, 59, 0.08), 0 2px 4px -2px rgba(11, 31, 59, 0.08)',
    inputFocus: '0 0 0 3px rgba(0, 167, 255, 0.1)',
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
