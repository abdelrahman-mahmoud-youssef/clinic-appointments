import { useContext, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CalendarEvent, EventDragContext } from './eventDrag';

interface EventChipProps {
  event: CalendarEvent;
}

export function EventChip({ event }: EventChipProps) {
  const startDrag = useContext(EventDragContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>('.rbc-event');
    if (!host || !startDrag) return;
    const onPointerDown = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerType !== 'mouse') {
        startDrag(event, pointerEvent);
      }
    };
    host.addEventListener('pointerdown', onPointerDown);
    return () => host.removeEventListener('pointerdown', onPointerDown);
  }, [event, startDrag]);

  return (
    <div
      ref={ref}
      className="flex h-full flex-col justify-center gap-0.5 overflow-hidden px-1 py-px leading-tight"
    >
      <span className="truncate font-display text-[0.8rem] font-medium">{event.title}</span>
      <span className="font-data text-[0.68rem] opacity-90">
        {format(event.start, 'h:mm')}–{format(event.end, 'h:mma').toLowerCase()}
      </span>
    </div>
  );
}
