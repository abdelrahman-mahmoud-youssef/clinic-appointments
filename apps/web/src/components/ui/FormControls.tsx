import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

const FIELD_CLASSES =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-faint';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={clsx(FIELD_CLASSES, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={clsx(FIELD_CLASSES, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={clsx(FIELD_CLASSES, className)} {...props} />;
  },
);

interface FieldProps {
  label: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}

export function Field({ label, children, error, className }: FieldProps) {
  return (
    <label className={clsx('mb-3 flex flex-col gap-1.5 text-sm font-medium text-ink-soft', className)}>
      <span>{label}</span>
      {children}
      {error && <span className="text-xs font-normal text-danger">{error}</span>}
    </label>
  );
}
