import { format } from 'date-fns';
import type { Appointment } from '@/lib/api/appointments';

interface EventChipProps {
  event: { title: string; start: Date; end: Date; resource: Appointment };
}

export function EventChip({ event }: EventChipProps) {
  return (
    <div className="flex h-full flex-col gap-0.5 overflow-hidden px-0.5 py-px leading-tight">
      <span className="truncate font-display text-[0.8rem] font-medium">{event.title}</span>
      <span className="font-data text-[0.68rem] opacity-90">
        {format(event.start, 'h:mm')}–{format(event.end, 'h:mma').toLowerCase()}
      </span>
    </div>
  );
}
