'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, Views, SlotInfo } from 'react-big-calendar';
import withDragAndDrop, { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, endOfWeek, startOfDay, endOfDay, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { listAppointments, Appointment } from '@/lib/api/appointments';
import { AppointmentFormModal } from '@/components/appointments/AppointmentFormModal';
import { useRescheduleAppointment } from '@/lib/query/useRescheduleAppointment';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { STATUS_COLORS } from './statusColors';
import { ErrorBanner } from './ErrorBanner';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

interface DateRange {
  from: Date;
  to: Date;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

const DragAndDropCalendar = withDragAndDrop<CalendarEvent>(Calendar);

function computeInitialRange(): DateRange {
  const now = new Date();
  return { from: startOfWeek(now), to: endOfWeek(now) };
}

export function AppointmentCalendar() {
  const [range, setRange] = useState<DateRange>(computeInitialRange);
  const [pendingSlot, setPendingSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const reschedule = useRescheduleAppointment();

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', range.from.toISOString(), range.to.toISOString()],
    queryFn: () =>
      listAppointments({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
  });

  const events: CalendarEvent[] = useMemo(
    () =>
      appointments.map((appointment) => ({
        id: appointment.id,
        title: appointment.reason || 'Appointment',
        start: new Date(appointment.startsAt),
        end: new Date(appointment.endsAt),
        resource: appointment,
      })),
    [appointments],
  );

  const handleRangeChange = useCallback((newRange: Date[] | { start: Date; end: Date }) => {
    if (Array.isArray(newRange)) {
      setRange({ from: startOfDay(newRange[0]), to: endOfDay(newRange[newRange.length - 1]) });
    } else {
      setRange({ from: startOfDay(newRange.start), to: endOfDay(newRange.end) });
    }
  }, []);

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const color = STATUS_COLORS[event.resource.status];
    return { style: { backgroundColor: color, borderColor: color } };
  }, []);

  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setPendingSlot({ start: slotInfo.start, end: slotInfo.end });
    setIsCreating(true);
  }, []);

  const handleEventDrop = useCallback(
    ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      reschedule.mutate({
        id: event.id,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
      });
    },
    [reschedule],
  );

  return (
    <>
      <div className="calendar-toolbar">
        <button
          className="primary"
          onClick={() => {
            setPendingSlot(null);
            setIsCreating(true);
          }}
        >
          New appointment
        </button>
      </div>
      {reschedule.isError && (
        <ErrorBanner message={extractErrorMessage(reschedule.error)} onDismiss={() => reschedule.reset()} />
      )}
      <DragAndDropCalendar
        localizer={localizer}
        events={events}
        defaultView={Views.WEEK}
        views={[Views.DAY, Views.WEEK, Views.MONTH]}
        onRangeChange={handleRangeChange}
        eventPropGetter={eventPropGetter}
        selectable
        onSelectSlot={handleSelectSlot}
        onEventDrop={handleEventDrop}
        resizable={false}
        style={{ height: 700 }}
        startAccessor="start"
        endAccessor="end"
      />
      {isCreating && (
        <AppointmentFormModal
          defaultStart={pendingSlot?.start}
          defaultEnd={pendingSlot?.end}
          onClose={() => setIsCreating(false)}
        />
      )}
    </>
  );
}
