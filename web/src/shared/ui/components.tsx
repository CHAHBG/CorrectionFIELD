// =====================================================
//  FieldCorrect — Reusable UI components
// =====================================================

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

// ── Button ──────────────────────────────────────────
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        'disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
          'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300': variant === 'secondary',
          'hover:bg-gray-100 text-gray-700': variant === 'ghost',
          'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
        },
        {
          'h-8 px-3 text-sm': size === 'sm',
          'h-9 px-4 text-sm': size === 'md',
          'h-10 px-6 text-base': size === 'lg',
          'h-8 w-8 p-0': size === 'icon',
        },
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';

// ── Input ───────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm',
        'placeholder:text-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

// ── Badge ───────────────────────────────────────────
export interface BadgeProps {
  variant?: 'default' | 'draft' | 'pending' | 'locked' | 'corrected' | 'validated' | 'rejected';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        {
          'bg-gray-100 text-gray-800': variant === 'default',
          'bg-orange-100 text-orange-800': variant === 'pending',
          'bg-yellow-100 text-yellow-800': variant === 'locked',
          'bg-blue-100 text-blue-800': variant === 'corrected',
          'bg-green-100 text-green-800': variant === 'validated',
          'bg-red-100 text-red-800': variant === 'rejected',
        },
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Spinner ─────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
    </div>
  );
}

// ── Tooltip (simple) ────────────────────────────────
export function Tooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: string;
}) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {content}
      </div>
    </div>
  );
}

// ── ResizablePanel ──────────────────────────────────
export function ResizablePanel({
  children,
  width,
  minWidth = 200,
  maxWidth = 600,
  side = 'left',
  className,
}: {
  children: React.ReactNode;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  side?: 'left' | 'right';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden border-gray-200',
        side === 'left' ? 'border-r' : 'border-l',
        className
      )}
      style={{
        width: Math.min(Math.max(width, minWidth), maxWidth),
        minWidth,
        maxWidth,
      }}
    >
      {children}
    </div>
  );
}
