'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Appointment, createAppointment, updateAppointment } from '@/lib/api/appointments';
import { listDoctors } from '@/lib/api/doctors';
import { createPatient, listPatients } from '@/lib/api/patients';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { toDateTimeLocalValue } from '@/lib/dateInput';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { PatientCombobox, PatientChoice } from './PatientCombobox';

interface Props {
  onClose: () => void;
  defaultStart?: Date;
  defaultEnd?: Date;
  defaultDoctorId?: string;
  appointment?: Appointment;
}

function defaultRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setMinutes(30);
  return { start, end };
}

export function AppointmentFormModal({
  onClose,
  defaultStart,
  defaultEnd,
  defaultDoctorId,
  appointment,
}: Props) {
  const queryClient = useQueryClient();
  const fallback = defaultRange();
  const editing = !!appointment;

  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: listDoctors });
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: listPatients });

  const [patientChoice, setPatientChoice] = useState<PatientChoice>(
    appointment?.patientId ? { patientId: appointment.patientId } : {},
  );
  const [doctorId, setDoctorId] = useState(appointment?.doctorId ?? defaultDoctorId ?? '');
  const [startsAt, setStartsAt] = useState(
    toDateTimeLocalValue(appointment ? new Date(appointment.startsAt) : defaultStart ?? fallback.start),
  );
  const [endsAt, setEndsAt] = useState(
    toDateTimeLocalValue(appointment ? new Date(appointment.endsAt) : defaultEnd ?? fallback.end),
  );
  const [reason, setReason] = useState(appointment?.reason ?? '');
  const [notes, setNotes] = useState(appointment?.notes ?? '');

  const save = useMutation({
    mutationFn: async () => {
      let resolvedPatientId = patientChoice.patientId;

      if (patientChoice.newPatientName !== undefined) {
        const created = await createPatient(patientChoice.newPatientName.trim());
        resolvedPatientId = created.id;
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        setPatientChoice({ patientId: created.id });
      }

      const payload = {
        patientId: resolvedPatientId!,
        doctorId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason: reason || undefined,
        notes: notes || undefined,
      };
      return editing ? updateAppointment(appointment!.id, payload) : createAppointment(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'], exact: false });
      onClose();
    },
  });

  const patientReady =
    !!patientChoice.patientId ||
    (patientChoice.newPatientName !== undefined && patientChoice.newPatientName.trim().length > 0);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!patientReady) {
      return;
    }
    save.mutate();
  }

  return (
    <Modal title={editing ? 'Edit appointment' : 'New appointment'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Patient">
          <PatientCombobox patients={patients} value={patientChoice} onChange={setPatientChoice} />
        </Field>

        <Field label="Doctor">
          <Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} required>
            <option value="" disabled>
              Select a doctor
            </option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Field label="Start">
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => {
                const value = event.target.value;
                setStartsAt(value);
                if (value) {
                  setEndsAt(toDateTimeLocalValue(new Date(new Date(value).getTime() + 60 * 60 * 1000)));
                }
              }}
              required
            />
          </Field>

          <Field label="End">
            <Input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
          </Field>
        </div>

        <Field label="Reason">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Checkup, follow-up..." />
        </Field>

        <Field label="Notes">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </Field>

        {save.isError && (
          <div className="mb-3">
            <Banner>{extractErrorMessage(save.error)}</Banner>
          </div>
        )}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending || !patientReady}>
            {save.isPending
              ? editing
                ? 'Saving…'
                : 'Creating…'
              : editing
                ? 'Save changes'
                : 'Create appointment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
