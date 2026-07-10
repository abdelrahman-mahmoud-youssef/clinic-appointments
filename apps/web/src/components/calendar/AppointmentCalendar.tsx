'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppointmentStatus, isWithinWorkingHours } from '@clinic/shared';
import { Calendar, dateFnsLocalizer, Views, SlotInfo, View, ToolbarProps } from 'react-big-calendar';
import withDragAndDrop, { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, endOfWeek, startOfDay, endOfDay, getDay, set } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { listAppointments, Appointment } from '@/lib/api/appointments';
import { getDoctorAvailability } from '@/lib/api/doctors';
import { getClinicSettings } from '@/lib/api/clinic';
import { useAuth } from '@/lib/auth/AuthContext';
import { RoleGate } from '@/components/auth/RoleGate';
import { CAN_BOOK } from '@/lib/auth/permissions';
import { AppointmentFormModal } from '@/components/appointments/AppointmentFormModal';
import { AppointmentDetailsModal } from '@/components/appointments/AppointmentDetailsModal';
import { useRescheduleAppointment } from '@/lib/query/useRescheduleAppointment';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { STATUS_COLORS } from './statusColors';
import { FiltersBar } from './FiltersBar';
import { CalendarToolbar } from './CalendarToolbar';
import { EventChip } from './EventChip';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

const SLOT_STEP_MINUTES = 30;
const MOBILE_BREAKPOINT = 640;
const DEFAULT_DAY_START_HOUR = 12;
const DEFAULT_DAY_END_HOUR = 24;

function hourToTime(hour: number): Date {
  return hour >= 24
    ? set(new Date(), { hours: 23, minutes: 59, seconds: 59, milliseconds: 999 })
    : set(new Date(), { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 });
}

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

const CALENDAR_VIEWS: View[] = [Views.DAY, Views.WEEK, Views.MONTH];

// Adapts react-big-calendar's own ToolbarProps (whose `views` field is a
// { day?, week?, ... } map, not a plain list) to CalendarToolbar's simpler,
// explicit availableViews prop.
function ToolbarAdapter(props: ToolbarProps<CalendarEvent, object>) {
  return (
    <CalendarToolbar
      label={props.label}
      view={props.view}
      availableViews={CALENDAR_VIEWS}
      onNavigate={props.onNavigate}
      onView={props.onView}
    />
  );
}

function computeInitialRange(): DateRange {
  const now = new Date();
  return { from: startOfWeek(now), to: endOfWeek(now) };
}

export function AppointmentCalendar() {
  const [range, setRange] = useState<DateRange>(computeInitialRange);
  const [view, setView] = useState<View>(Views.WEEK);
  const [pendingSlot, setPendingSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | undefined>();
  const [closedSlotNotice, setClosedSlotNotice] = useState<string | null>(null);
  const { role } = useAuth();
  const canBook = role ? CAN_BOOK.includes(role) : false;
  const reschedule = useRescheduleAppointment();

  // Default to Day view on narrow screens. Adjusted after mount, not during
  // the initial render, so the server-rendered markup and the first client
  // render still match (no layout-shift/hydration warning).
  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setView(Views.DAY);
    }
  }, []);

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', range.from.toISOString(), range.to.toISOString(), doctorFilter, statusFilter],
    queryFn: () =>
      listAppointments({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        doctorId: doctorFilter,
        status: statusFilter,
      }),
  });

  // Closed-slot shading is inherently per-doctor, so it only activates once a
  // specific doctor is chosen in the filter — "closed" has no single meaning
  // across every doctor at once.
  const { data: doctorWindows } = useQuery({
    queryKey: ['doctor-availability', doctorFilter],
    queryFn: () => getDoctorAvailability(doctorFilter as string),
    enabled: !!doctorFilter,
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: getClinicSettings,
  });

  const dayStartHour = clinicSettings?.dayStartHour ?? DEFAULT_DAY_START_HOUR;
  const dayEndHour = clinicSettings?.dayEndHour ?? DEFAULT_DAY_END_HOUR;
  const minTime = useMemo(() => hourToTime(dayStartHour), [dayStartHour]);
  const maxTime = useMemo(() => hourToTime(dayEndHour), [dayEndHour]);

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

  const isSlotClosed = useCallback(
    (start: Date) => {
      if (!doctorFilter || !doctorWindows || !clinicSettings) {
        return false;
      }
      const end = new Date(start.getTime() + SLOT_STEP_MINUTES * 60_000);
      return !isWithinWorkingHours(doctorWindows, start, end, clinicSettings.timezone);
    },
    [doctorFilter, doctorWindows, clinicSettings],
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

  const slotPropGetter = useCallback(
    (date: Date) =>
      date.getTime() < Date.now() || isSlotClosed(date) ? { className: 'slot-closed' } : {},
    [isSlotClosed],
  );

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      if (slotInfo.end.getTime() <= Date.now()) {
        setClosedSlotNotice('That time is in the past. Pick a future slot to book an appointment.');
        return;
      }
      if (isSlotClosed(slotInfo.start)) {
        setClosedSlotNotice(
          "This doctor isn't available at that time. Pick an open slot, or clear the doctor filter to book any doctor.",
        );
        return;
      }
      setClosedSlotNotice(null);
      setPendingSlot({ start: slotInfo.start, end: slotInfo.end });
      setIsCreating(true);
    },
    [isSlotClosed],
  );

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

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedAppointment(event.resource);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <FiltersBar
          doctorId={doctorFilter}
          onDoctorIdChange={setDoctorFilter}
          status={statusFilter}
          onStatusChange={setStatusFilter}
        />
        <RoleGate roles={CAN_BOOK}>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            onClick={() => {
              setPendingSlot(null);
              setIsCreating(true);
            }}
          >
            New appointment
          </Button>
        </RoleGate>
      </div>

      {reschedule.isError && (
        <Banner onDismiss={() => reschedule.reset()}>{extractErrorMessage(reschedule.error)}</Banner>
      )}
      {closedSlotNotice && <Banner onDismiss={() => setClosedSlotNotice(null)}>{closedSlotNotice}</Banner>}

      <div
        className={`h-[520px] overflow-hidden rounded-lg border border-line bg-surface p-2 sm:h-[640px] sm:p-4${
          canBook ? ' calendar-bookable' : ''
        }`}
      >
        <DragAndDropCalendar
          localizer={localizer}
          events={events}
          view={view}
          onView={(nextView) => setView(nextView)}
          views={CALENDAR_VIEWS}
          step={SLOT_STEP_MINUTES}
          timeslots={1}
          min={minTime}
          max={maxTime}
          onRangeChange={handleRangeChange}
          eventPropGetter={eventPropGetter}
          slotPropGetter={slotPropGetter}
          selectable={canBook}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          draggableAccessor={() => canBook}
          resizable={false}
          style={{ height: '100%' }}
          startAccessor="start"
          endAccessor="end"
          components={{ toolbar: ToolbarAdapter, event: EventChip }}
        />
      </div>

      {isCreating && (
        <AppointmentFormModal
          defaultStart={pendingSlot?.start}
          defaultEnd={pendingSlot?.end}
          onClose={() => setIsCreating(false)}
        />
      )}
      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
        />
      )}
    </div>
  );
}
