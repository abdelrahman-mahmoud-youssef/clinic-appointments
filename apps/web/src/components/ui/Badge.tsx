import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  color: string;
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white',
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}
