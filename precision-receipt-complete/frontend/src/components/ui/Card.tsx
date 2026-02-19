/**
 * Card Component
 * Following Precision Receipt Design System
 * - Subtle shadow
 * - 12-16px padding
 * - Clear header + body separation
 */

import React from 'react';
import clsx from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  bordered?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  shadow = 'md',
  hover = false,
  bordered = false,
  className,
  ...props
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',     // 16px
    lg: 'p-6',     // 24px
  };

  const shadowStyles = {
    sm: 'shadow-sm',
    md: 'shadow-card',
    lg: 'shadow-lg',
  };

  return (
    <div
      className={clsx(
        // Base
        'bg-surface rounded-card',
        
        // Padding
        paddingStyles[padding],
        
        // Shadow
        shadowStyles[shadow],
        hover && 'hover:shadow-card-hover transition-shadow duration-200',
        
        // Border
        bordered && 'border border-border',
        
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'flex items-start justify-between',
        'pb-4 mb-4 border-b border-border',
        className
      )}
      {...props}
    >
      <div className="flex-1">
        <h3 className="text-lg font-bold text-text-primary">{title}</h3>
        {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
        {children}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
};

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardBody: React.FC<CardBodyProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={clsx('', className)} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'pt-4 mt-4 border-t border-border',
        'flex items-center justify-end gap-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Compound component typing
type CardComponent = React.FC<CardProps> & {
  Header: typeof CardHeader;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

(Card as CardComponent).Header = CardHeader;
(Card as CardComponent).Body = CardBody;
(Card as CardComponent).Footer = CardFooter;

export default Card as CardComponent;
