'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAppointment } from '@/lib/api/appointments';
import { listDoctors } from '@/lib/api/doctors';
import { listPatients } from '@/lib/api/patients';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { toDateTimeLocalValue } from '@/lib/dateInput';

interface Props {
  onClose: () => void;
  defaultStart?: Date;
  defaultEnd?: Date;
}

function defaultRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setMinutes(30);
  return { start, end };
}

export function AppointmentFormModal({ onClose, defaultStart, defaultEnd }: Props) {
  const queryClient = useQueryClient();
  const fallback = defaultRange();

  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: listDoctors });
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: listPatients });

  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [startsAt, setStartsAt] = useState(toDateTimeLocalValue(defaultStart ?? fallback.start));
  const [endsAt, setEndsAt] = useState(toDateTimeLocalValue(defaultEnd ?? fallback.end));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const create = useMutation({
    mutationFn: () =>
      createAppointment({
        patientId,
        doctorId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason: reason || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'], exact: false });
      onClose();
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <h2>New appointment</h2>

        <label>
          Patient
          <select value={patientId} onChange={(event) => setPatientId(event.target.value)} required>
            <option value="" disabled>
              Select a patient
            </option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Doctor
          <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} required>
            <option value="" disabled>
              Select a doctor
            </option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Start
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </label>

        <label>
          End
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
        </label>

        <label>
          Reason
          <input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>

        <label>
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </label>

        {create.isError && <p className="form-error">{extractErrorMessage(create.error)}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={create.isPending}>
            {create.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
