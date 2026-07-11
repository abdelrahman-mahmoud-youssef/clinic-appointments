'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AppointmentStatus, isWithinWorkingHours, Role } from '@clinic/shared';
import { Calendar, dateFnsLocalizer, Views, SlotInfo, View, ToolbarProps } from 'react-big-calendar';
import withDragAndDrop, { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, startOfDay, endOfDay, getDay, set } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { listAppointments, Appointment } from '@/lib/api/appointments';
import { getDoctorAvailability, listDoctors } from '@/lib/api/doctors';
import { getClinicSettings } from '@/lib/api/clinic';
import { useAuth } from '@/lib/auth/AuthContext';
import { RoleGate } from '@/components/auth/RoleGate';
import { CAN_BOOK } from '@/lib/auth/permissions';
import { AppointmentFormModal } from '@/components/appointments/AppointmentFormModal';
import { AppointmentDetailsModal } from '@/components/appointments/AppointmentDetailsModal';
import { useRescheduleAppointment } from '@/lib/query/useRescheduleAppointment';
import { useMoveAppointment } from '@/lib/query/useMoveAppointment';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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
  resourceId: string;
  resource: Appointment;
}

const DragAndDropCalendar = withDragAndDrop<CalendarEvent>(Calendar);

const CALENDAR_VIEWS: View[] = [Views.DAY, Views.WEEK, Views.MONTH];

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
  return { from: startOfDay(now), to: endOfDay(now) };
}

export function AppointmentCalendar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [range, setRange] = useState<DateRange>(computeInitialRange);
  const [view, setView] = useState<View>(Views.DAY);
  const [pendingSlot, setPendingSlot] = useState<{ start: Date; end: Date; doctorId?: string } | null>(
    null,
  );
  const [pendingMove, setPendingMove] = useState<{
    event: CalendarEvent;
    start: Date;
    end: Date;
    targetDoctorId?: string;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [closedSlotNotice, setClosedSlotNotice] = useState<string | null>(null);
  const { role } = useAuth();
  const canBook = role ? CAN_BOOK.includes(role) : false;
  const reschedule = useRescheduleAppointment();
  const move = useMoveAppointment();

  const doctorFilter = searchParams.get('doctorId') || undefined;
  const statusFilter = (searchParams.get('status') as AppointmentStatus | null) || undefined;
  const dateParam = searchParams.get('date');
  const date = useMemo(
    () => (dateParam ? new Date(`${dateParam}T00:00:00`) : new Date()),
    [dateParam],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

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

  const { data: doctorWindows } = useQuery({
    queryKey: ['doctor-availability', doctorFilter],
    queryFn: () => getDoctorAvailability(doctorFilter as string),
    enabled: !!doctorFilter,
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: getClinicSettings,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: listDoctors,
    enabled: role !== Role.DOCTOR,
  });

  const resources = useMemo(
    () => doctors.map((doctor) => ({ id: doctor.id, title: doctor.name })),
    [doctors],
  );
  const showResources =
    view === Views.DAY && !doctorFilter && role !== Role.DOCTOR && resources.length > 1;

  const doctorName = (id: string) =>
    doctors.find((doctor) => doctor.id === id)?.name ?? 'Unknown doctor';

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
        resourceId: appointment.doctorId,
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
      const doctorId =
        slotInfo.resourceId != null ? String(slotInfo.resourceId) : doctorFilter;
      setPendingSlot({ start: slotInfo.start, end: slotInfo.end, doctorId });
      setIsCreating(true);
    },
    [isSlotClosed, doctorFilter],
  );

  const handleEventDrop = useCallback(
    ({ event, start, end, resourceId }: EventInteractionArgs<CalendarEvent>) => {
      setPendingMove({
        event,
        start: new Date(start),
        end: new Date(end),
        targetDoctorId: resourceId != null ? String(resourceId) : undefined,
      });
    },
    [],
  );

  const confirmMove = useCallback(() => {
    if (!pendingMove) return;
    const { event, start, end, targetDoctorId } = pendingMove;
    const startsAt = start.toISOString();
    const endsAt = end.toISOString();

    if (targetDoctorId && targetDoctorId !== event.resource.doctorId) {
      move.mutate({ appointment: event.resource, doctorId: targetDoctorId, startsAt, endsAt });
    } else {
      reschedule.mutate({ id: event.id, startsAt, endsAt });
    }
    setPendingMove(null);
  }, [pendingMove, reschedule, move]);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedAppointment(event.resource);
  }, []);

  const isDoctorMove =
    pendingMove != null &&
    pendingMove.targetDoctorId != null &&
    pendingMove.targetDoctorId !== pendingMove.event.resource.doctorId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <FiltersBar
          doctorId={doctorFilter}
          onDoctorIdChange={(value) => setFilter('doctorId', value)}
          status={statusFilter}
          onStatusChange={(value) => setFilter('status', value)}
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
      {move.isError && (
        <Banner onDismiss={() => move.reset()}>{extractErrorMessage(move.error)}</Banner>
      )}
      {closedSlotNotice && <Banner onDismiss={() => setClosedSlotNotice(null)}>{closedSlotNotice}</Banner>}

      <div
        className={`h-[520px] overflow-hidden rounded-lg border border-line bg-surface p-2 sm:h-[640px] sm:p-4${
          canBook ? ' calendar-bookable' : ''
        }${canBook && view === Views.DAY ? ' calendar-day' : ''}`}
      >
        <DragAndDropCalendar
          localizer={localizer}
          events={events}
          date={date}
          onNavigate={(nextDate) => setFilter('date', format(nextDate, 'yyyy-MM-dd'))}
          view={view}
          onView={(nextView) => setView(nextView)}
          views={CALENDAR_VIEWS}
          resources={showResources ? resources : undefined}
          resourceIdAccessor={(resource) => (resource as { id: string }).id}
          resourceTitleAccessor={(resource) => (resource as { title: string }).title}
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
          draggableAccessor={() => canBook && view === Views.DAY}
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
          defaultDoctorId={pendingSlot?.doctorId}
          onClose={() => setIsCreating(false)}
        />
      )}
      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
        />
      )}
      {pendingMove && (
        <Modal
          title={isDoctorMove ? 'Move appointment' : 'Reschedule appointment'}
          onClose={() => setPendingMove(null)}
        >
          <p className="text-sm text-ink-soft">{pendingMove.event.title}</p>
          <dl className="mt-4 space-y-2 text-sm">
            {isDoctorMove && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Doctor</dt>
                <dd className="text-right text-ink">
                  {doctorName(pendingMove.event.resource.doctorId)} →{' '}
                  {doctorName(pendingMove.targetDoctorId as string)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">From</dt>
              <dd className="font-data text-ink">{format(pendingMove.event.start, 'EEE d MMM, HH:mm')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">To</dt>
              <dd className="font-data text-ink">{format(pendingMove.start, 'EEE d MMM, HH:mm')}</dd>
            </div>
          </dl>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingMove(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmMove}>
              Confirm
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
