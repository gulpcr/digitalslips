/**
 * Button Component
 * Following Precision Receipt Design System
 * - 8px radius
 * - Strong primary CTA in Cyan
 * - Hover darken slightly
 */

import React from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = clsx(
    // Base
    'inline-flex items-center justify-center gap-2',
    'font-medium transition-all duration-200',
    'rounded-button',  // 8px radius
    'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    
    // Full width
    fullWidth && 'w-full',
  );

  const variantStyles = {
    primary: clsx(
      'bg-accent text-white',
      'hover:bg-accent-600 active:bg-accent-700',
      'shadow-sm hover:shadow-md',
    ),
    secondary: clsx(
      'bg-primary text-white',
      'hover:bg-primary-600 active:bg-primary-700',
      'shadow-sm hover:shadow-md',
    ),
    outline: clsx(
      'border-2 border-accent text-accent bg-transparent',
      'hover:bg-accent-50 active:bg-accent-100',
    ),
    ghost: clsx(
      'text-primary bg-transparent',
      'hover:bg-primary-50 active:bg-primary-100',
    ),
    danger: clsx(
      'bg-error text-white',
      'hover:bg-error-600 active:bg-error-700',
      'shadow-sm hover:shadow-md',
    ),
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      
      {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      
      <span>{children}</span>
      
      {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};

export default Button;
