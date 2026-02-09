/**
 * Table Component
 * Following Precision Receipt Design System
 * - Clean grid lines
 * - Zebra optional
 * - Sticky header if long lists
 */

import React from 'react';
import clsx from 'clsx';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  stickyHeader?: boolean;
}

export const Table: React.FC<TableProps> = ({
  children,
  striped = false,
  hoverable = true,
  bordered = true,
  stickyHeader = false,
  className,
  ...props
}) => {
  return (
    <div className="overflow-x-auto">
      <table
        className={clsx(
          'w-full',
          'text-sm text-left',
          bordered && 'border-collapse',
          className
        )}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              striped,
              hoverable,
              bordered,
              stickyHeader,
            });
          }
          return child;
        })}
      </table>
    </div>
  );
};

export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
  stickyHeader?: boolean;
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  stickyHeader = false,
  className,
  ...props
}) => {
  return (
    <thead
      className={clsx(
        'bg-primary text-white',
        stickyHeader && 'sticky top-0 z-10',
        className
      )}
      {...props}
    >
      {children}
    </thead>
  );
};

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
  striped?: boolean;
  hoverable?: boolean;
}

export const TableBody: React.FC<TableBodyProps> = ({
  children,
  striped = false,
  hoverable = true,
  className,
  ...props
}) => {
  return (
    <tbody className={clsx('bg-white divide-y divide-border', className)} {...props}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            striped: striped && index % 2 === 1,
            hoverable,
          });
        }
        return child;
      })}
    </tbody>
  );
};

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  striped?: boolean;
  hoverable?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  striped = false,
  hoverable = true,
  className,
  ...props
}) => {
  return (
    <tr
      className={clsx(
        'transition-colors duration-150',
        striped && 'bg-background-light',
        hoverable && 'hover:bg-accent-50',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  header?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  header = false,
  className,
  ...props
}) => {
  const Component = header ? 'th' : 'td';

  return (
    <Component
      className={clsx(
        'px-4 py-3',
        header
          ? 'font-semibold text-white text-left'
          : 'text-text-primary',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
};

// Compound component
Table.Head = TableHead;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Cell = TableCell;

export default Table;
