'use client';

import clsx from 'clsx';
import { View, Views } from 'react-big-calendar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/FormControls';

// react-big-calendar's own ToolbarProps.views is a { day?, week?, month?, ... }
// map, not the plain string list we actually want here — so this component
// takes an explicit availableViews prop instead of relying on that shape.
interface ToolbarProps {
  label: string;
  view: View;
  availableViews: View[];
  onNavigate: (action: 'TODAY' | 'PREV' | 'NEXT') => void;
  onView: (view: View) => void;
}

const VIEW_LABELS: Record<string, string> = {
  [Views.DAY]: 'Day',
  [Views.WEEK]: 'Week',
  [Views.MONTH]: 'Month',
};

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarToolbar({ label, view, availableViews, onNavigate, onView }: ToolbarProps) {
  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => onNavigate('TODAY')}>
          Today
        </Button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => onNavigate('PREV')}
            className="rounded-md p-1.5 text-ink-soft hover:bg-bg"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => onNavigate('NEXT')}
            className="rounded-md p-1.5 text-ink-soft hover:bg-bg"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
        <span className="font-display text-sm font-medium text-ink sm:text-base">{label}</span>
      </div>

      <Select
        value={view}
        onChange={(event) => onView(event.target.value as View)}
        className="sm:hidden"
        aria-label="Calendar view"
      >
        {availableViews.map((v) => (
          <option key={v} value={v}>
            {VIEW_LABELS[v] ?? v}
          </option>
        ))}
      </Select>

      <div className="hidden overflow-hidden rounded-md border border-line sm:flex">
        {availableViews.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            className={clsx(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              v === view ? 'bg-brand text-white' : 'bg-surface text-ink-soft hover:bg-bg',
            )}
          >
            {VIEW_LABELS[v] ?? v}
          </button>
        ))}
      </div>
    </div>
  );
}
