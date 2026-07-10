'use client';

import { ReactNode, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AppointmentStatus, getAllowedNextStatuses } from '@clinic/shared';
import { Appointment, changeAppointmentStatus } from '@/lib/api/appointments';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { useDirectory } from '@/lib/query/useDirectory';
import { StatusBadge } from '@/components/calendar/StatusBadge';
import { RoleGate } from '@/components/auth/RoleGate';
import { CAN_CHANGE_STATUS, CAN_BOOK } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { AppointmentFormModal } from './AppointmentFormModal';

const ACTION_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Mark scheduled',
  [AppointmentStatus.CONFIRMED]: 'Confirm',
  [AppointmentStatus.COMPLETED]: 'Complete',
  [AppointmentStatus.CANCELLED]: 'Cancel',
  [AppointmentStatus.NO_SHOW]: 'Mark no-show',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-ink-faint">{label}</span>
      <span className="text-right text-sm text-ink">{children}</span>
    </div>
  );
}

interface Props {
  appointment: Appointment;
  onStatusChanged?: () => void;
  footer?: ReactNode;
}

export function AppointmentDetailView({ appointment, onStatusChanged, footer }: Props) {
  const queryClient = useQueryClient();
  const { doctorName, patientName } = useDirectory();
  const allowedNext = getAllowedNextStatuses(appointment.status);
  const [editing, setEditing] = useState(false);

  const changeStatus = useMutation({
    mutationFn: (status: AppointmentStatus) => changeAppointmentStatus(appointment.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'], exact: false });
      onStatusChanged?.();
    },
  });

  if (editing) {
    return <AppointmentFormModal appointment={appointment} onClose={() => setEditing(false)} />;
  }

  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);

  return (
    <>
      <div className="divide-y divide-line">
        <Row label="When">
          {format(start, 'EEE, MMM d')}
          <span className="block font-data text-xs text-ink-soft">
            {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
          </span>
        </Row>
        <Row label="Status">
          <StatusBadge status={appointment.status} />
        </Row>
        <Row label="Doctor">{doctorName(appointment.doctorId)}</Row>
        <Row label="Patient">{patientName(appointment.patientId)}</Row>
        {appointment.reason && <Row label="Reason">{appointment.reason}</Row>}
        {appointment.notes && <Row label="Notes">{appointment.notes}</Row>}
      </div>

      <RoleGate roles={CAN_CHANGE_STATUS}>
        <div className="mt-5 border-t border-line pt-4">
          {allowedNext.length === 0 ? (
            <p className="text-sm text-ink-soft">This appointment is in a terminal state.</p>
          ) : (
            <>
              <p className="mb-2 font-display text-xs font-medium uppercase tracking-wide text-ink-faint">
                Change status
              </p>
              <div className="flex flex-wrap gap-2">
                {allowedNext.map((status) => (
                  <Button
                    key={status}
                    variant="secondary"
                    onClick={() => changeStatus.mutate(status)}
                    disabled={changeStatus.isPending}
                  >
                    {ACTION_LABELS[status]}
                  </Button>
                ))}
              </div>
            </>
          )}
          {changeStatus.isError && (
            <div className="mt-3">
              <Banner>{extractErrorMessage(changeStatus.error)}</Banner>
            </div>
          )}
        </div>
      </RoleGate>

      <div className="mt-5 flex justify-end gap-2">
        {footer}
        <RoleGate roles={CAN_BOOK}>
          <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </RoleGate>
      </div>
    </>
  );
}
