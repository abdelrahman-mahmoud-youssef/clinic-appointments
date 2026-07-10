interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
}

export function StatCard({ label, value, hint, accent }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-surface p-4 sm:p-5">
      {accent && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: accent }}
        />
      )}
      <p className="font-display text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-2 font-data text-3xl font-medium tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
