/**
 * Input Component
 * Following Precision Receipt Design System
 * - Soft border
 * - Purple focus ring
 * - Clear error messaging
 */

import React from 'react';
import clsx from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | boolean;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = React.useId();
    const hasError = Boolean(error);

    return (
      <div className={clsx('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-primary"
          >
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={clsx(
              // Base
              'w-full px-3 py-2',
              'text-base text-text-primary',
              'bg-white border rounded-input',
              'transition-all duration-200',
              
              // Focus
              'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
              'focus:shadow-input-focus',
              
              // States
              hasError
                ? 'border-error focus:ring-error focus:border-error'
                : 'border-border',
              disabled && 'bg-gray-50 text-text-secondary cursor-not-allowed opacity-60',
              
              // Icons
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              
              className
            )}
            disabled={disabled}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
              {rightIcon}
            </div>
          )}
        </div>

        {(error || helperText) && (
          <p
            className={clsx(
              'text-sm',
              hasError ? 'text-error' : 'text-text-secondary'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | boolean;
  helperText?: string;
  fullWidth?: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const textareaId = React.useId();
    const hasError = Boolean(error);

    return (
      <div className={clsx('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-text-primary"
          >
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            // Base
            'w-full px-3 py-2',
            'text-base text-text-primary',
            'bg-white border rounded-input',
            'transition-all duration-200',
            'resize-y min-h-[100px]',
            
            // Focus
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
            'focus:shadow-input-focus',
            
            // States
            hasError
              ? 'border-error focus:ring-error focus:border-error'
              : 'border-border',
            disabled && 'bg-gray-50 text-text-secondary cursor-not-allowed opacity-60',
            
            className
          )}
          disabled={disabled}
          {...props}
        />

        {(error || helperText) && (
          <p
            className={clsx(
              'text-sm',
              hasError ? 'text-error' : 'text-text-secondary'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default Input;
