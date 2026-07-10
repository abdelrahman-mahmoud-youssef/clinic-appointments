'use client';

import { Appointment } from '@/lib/api/appointments';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AppointmentDetailView } from './AppointmentDetailView';

export function AppointmentDetailsModal({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  return (
    <Modal title={appointment.reason || 'Appointment'} onClose={onClose}>
      <AppointmentDetailView
        appointment={appointment}
        onStatusChanged={onClose}
        footer={
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      />
    </Modal>
  );
}
