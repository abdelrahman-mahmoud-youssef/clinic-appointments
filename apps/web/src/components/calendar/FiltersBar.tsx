'use client';

import { useQuery } from '@tanstack/react-query';
import { AppointmentStatus, Role } from '@clinic/shared';
import { listDoctors } from '@/lib/api/doctors';
import { useAuth } from '@/lib/auth/AuthContext';
import { Field, Select } from '@/components/ui/FormControls';
import { SearchInput } from '@/components/ui/SearchInput';
import { STATUS_LABELS } from './statusColors';

interface Props {
  doctorId: string | undefined;
  onDoctorIdChange: (doctorId: string | undefined) => void;
  status: AppointmentStatus | undefined;
  onStatusChange: (status: AppointmentStatus | undefined) => void;
  q: string;
  onQChange: (q: string | undefined) => void;
}

export function FiltersBar({ doctorId, onDoctorIdChange, status, onStatusChange, q, onQChange }: Props) {
  const { role } = useAuth();
  const showDoctorFilter = role !== Role.DOCTOR;
  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: listDoctors,
    enabled: showDoctorFilter,
  });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Field label="Search" className="mb-0 sm:w-56">
          <SearchInput
            value={q}
            onChange={(value) => onQChange(value || undefined)}
            placeholder="Patient or reason"
          />
        </Field>

        {showDoctorFilter && (
          <Field label="Doctor" className="mb-0 sm:w-48">
            <Select value={doctorId ?? ''} onChange={(event) => onDoctorIdChange(event.target.value || undefined)}>
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
          <Select
            value={status ?? ''}
            onChange={(event) => onStatusChange((event.target.value || undefined) as AppointmentStatus | undefined)}
          >
            <option value="">All statuses</option>
            {Object.values(AppointmentStatus).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {showDoctorFilter && !doctorId && (
        <p className="mt-2 text-xs text-ink-faint">
          Pick a doctor to see their closed hours on the calendar.
        </p>
      )}
    </div>
  );
}
