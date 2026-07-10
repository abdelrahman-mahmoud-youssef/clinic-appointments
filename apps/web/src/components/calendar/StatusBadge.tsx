import { AppointmentStatus } from '@clinic/shared';
import { Badge } from '@/components/ui/Badge';
import { STATUS_COLORS, STATUS_LABELS } from './statusColors';

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>;
}
