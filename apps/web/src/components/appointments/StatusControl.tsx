'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AppointmentStatus, getAllowedNextStatuses } from '@clinic/shared';
import { Appointment, changeAppointmentStatus } from '@/lib/api/appointments';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { StatusBadge } from '@/components/calendar/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';

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
    <Modal title={appointment.reason || 'Appointment'} onClose={onClose}>
      <p className="mb-1 font-data text-sm text-ink-soft">
        {format(new Date(appointment.startsAt), 'EEE, MMM d · h:mma')}–{format(new Date(appointment.endsAt), 'h:mma').toLowerCase()}
      </p>
      <p className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        Status <StatusBadge status={appointment.status} />
      </p>

      {allowedNext.length === 0 ? (
        <p className="mb-4 text-sm text-ink-soft">This appointment is in a terminal state; no further changes are allowed.</p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
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
      )}

      {changeStatus.isError && (
        <div className="mb-4">
          <Banner>{extractErrorMessage(changeStatus.error)}</Banner>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
