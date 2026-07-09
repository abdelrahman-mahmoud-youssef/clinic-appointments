'use client';

import { useQuery } from '@tanstack/react-query';
import { AppointmentStatus } from '@clinic/shared';
import { listDoctors } from '@/lib/api/doctors';
import { STATUS_LABELS } from './statusColors';

interface Props {
  doctorId: string | undefined;
  onDoctorIdChange: (doctorId: string | undefined) => void;
  status: AppointmentStatus | undefined;
  onStatusChange: (status: AppointmentStatus | undefined) => void;
}

export function FiltersBar({ doctorId, onDoctorIdChange, status, onStatusChange }: Props) {
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: listDoctors });

  return (
    <div className="filters-bar">
      <label>
        Doctor
        <select
          value={doctorId ?? ''}
          onChange={(event) => onDoctorIdChange(event.target.value || undefined)}
        >
          <option value="">All doctors</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Status
        <select
          value={status ?? ''}
          onChange={(event) =>
            onStatusChange((event.target.value || undefined) as AppointmentStatus | undefined)
          }
        >
          <option value="">All statuses</option>
          {Object.values(AppointmentStatus).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
