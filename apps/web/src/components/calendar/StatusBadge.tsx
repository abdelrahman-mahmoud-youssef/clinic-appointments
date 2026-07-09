import { AppointmentStatus } from '@clinic/shared';
import { STATUS_COLORS, STATUS_LABELS } from './statusColors';

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className="status-badge" style={{ backgroundColor: STATUS_COLORS[status] }}>
      {STATUS_LABELS[status]}
    </span>
  );
}
