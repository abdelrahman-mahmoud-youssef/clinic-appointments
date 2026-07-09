'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppointmentStatus, getAllowedNextStatuses } from '@clinic/shared';
import { Appointment, changeAppointmentStatus } from '@/lib/api/appointments';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { StatusBadge } from '@/components/calendar/StatusBadge';

const ACTION_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Mark scheduled',
  [AppointmentStatus.CONFIRMED]: 'Confirm',
  [AppointmentStatus.COMPLETED]: 'Complete',
  [AppointmentStatus.CANCELLED]: 'Cancel',
  [AppointmentStatus.NO_SHOW]: 'Mark no-show',
};

interface Props {
  appointment: Appointment;
  onClose: () => void;
}

export function StatusControl({ appointment, onClose }: Props) {
  const queryClient = useQueryClient();
  const allowedNext = getAllowedNextStatuses(appointment.status);

  const changeStatus = useMutation({
    mutationFn: (status: AppointmentStatus) => changeAppointmentStatus(appointment.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'], exact: false });
      onClose();
    },
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>{appointment.reason || 'Appointment'}</h2>
        <p>
          Status: <StatusBadge status={appointment.status} />
        </p>

        {allowedNext.length === 0 ? (
          <p>This appointment is in a terminal state; no further changes are allowed.</p>
        ) : (
          <div className="status-actions">
            {allowedNext.map((status) => (
              <button key={status} onClick={() => changeStatus.mutate(status)} disabled={changeStatus.isPending}>
                {ACTION_LABELS[status]}
              </button>
            ))}
          </div>
        )}

        {changeStatus.isError && <p className="form-error">{extractErrorMessage(changeStatus.error)}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
