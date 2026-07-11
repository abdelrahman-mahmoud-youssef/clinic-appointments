import { createContext } from 'react';
import type { Appointment } from '@/lib/api/appointments';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resourceId: string;
  resource: Appointment;
}

export type StartEventDrag = (event: CalendarEvent, pointerEvent: PointerEvent) => void;

export const EventDragContext = createContext<StartEventDrag | null>(null);
