import clsx from 'clsx';

interface BannerProps {
  tone?: 'danger' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}

export function Banner({ tone = 'danger', children, onDismiss }: BannerProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={clsx(
        'flex items-center justify-between gap-3 rounded-md border px-3.5 py-2.5 text-sm',
        tone === 'danger' && 'border-danger/20 bg-danger-soft text-danger',
        tone === 'info' && 'border-brand/20 bg-brand-soft text-brand',
      )}
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-medium underline underline-offset-2"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
