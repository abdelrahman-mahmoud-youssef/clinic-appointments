'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppointmentStatus, Role } from '@clinic/shared';
import { format } from 'date-fns';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { listAppointments, Appointment } from '@/lib/api/appointments';
import { listDoctors } from '@/lib/api/doctors';
import { useDirectory } from '@/lib/query/useDirectory';
import { AppShell } from '@/components/layout/AppShell';
import { AppointmentDetailsModal } from '@/components/appointments/AppointmentDetailsModal';
import { StatusBadge } from '@/components/calendar/StatusBadge';
import { Field, Select, Input } from '@/components/ui/FormControls';
import { STATUS_LABELS } from '@/components/calendar/statusColors';

function toStart(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

function toEnd(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59`).toISOString() : undefined;
}

export default function AppointmentsListPage() {
  const isReady = useRequireAuth();
  const { role } = useAuth();
  const { doctorName, patientName } = useDirectory();

  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Appointment | null>(null);

  const showDoctorFilter = role !== Role.DOCTOR;
  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: listDoctors,
    enabled: isReady && showDoctorFilter,
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', 'list', doctorId, status, from, to],
    queryFn: () =>
      listAppointments({
        doctorId: doctorId || undefined,
        status: (status || undefined) as AppointmentStatus | undefined,
        from: toStart(from),
        to: toEnd(to),
      }),
    enabled: isReady,
  });

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold text-ink">Appointments</h1>
        <p className="mt-1 text-sm text-ink-soft">Filter and browse every appointment in a list.</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        {showDoctorFilter && (
          <Field label="Doctor" className="mb-0 sm:w-48">
            <Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
              <option value="">All doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Status" className="mb-0 sm:w-44">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {Object.values(AppointmentStatus).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From" className="mb-0 sm:w-40">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To" className="mb-0 sm:w-40">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line font-display text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Doctor</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">Loading…</td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                  No appointments match these filters.
                </td>
              </tr>
            ) : (
              appointments.map((appointment) => (
                <tr
                  key={appointment.id}
                  onClick={() => setSelected(appointment)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-bg"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-ink">{format(new Date(appointment.startsAt), 'MMM d')}</span>
                    <span className="ml-2 font-data text-xs text-ink-soft">
                      {format(new Date(appointment.startsAt), 'HH:mm')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink">{doctorName(appointment.doctorId)}</td>
                  <td className="px-4 py-3 text-ink">{patientName(appointment.patientId)}</td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-ink-soft">
                    {appointment.reason || 'Appointment'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={appointment.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <AppointmentDetailsModal appointment={selected} onClose={() => setSelected(null)} />
      )}
    </AppShell>
  );
}
