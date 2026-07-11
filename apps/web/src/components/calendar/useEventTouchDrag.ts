'use client';

import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { CalendarEvent } from './eventDrag';

const MOVE_THRESHOLD = 8;
const STEP_MINUTES = 30;
const EDGE = 44;
const AUTO_SCROLL = 14;

export interface DragConfig {
  date: Date;
  dayStartHour: number;
  dayEndHour: number;
  resources: { id: string }[];
  showResources: boolean;
  onDrop: (result: { event: CalendarEvent; start: Date; end: Date; doctorId: string }) => void;
}

interface Target {
  start: Date;
  end: Date;
  doctorId: string;
  label: string;
}

interface ActiveDrag {
  event: CalendarEvent;
  pointerId: number;
  startX: number;
  startY: number;
  grabOffsetY: number;
  dragging: boolean;
  node: HTMLElement | null;
  target: Target | null;
}

export interface DragPreview {
  x: number;
  y: number;
  label: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function timeContent(): HTMLElement | null {
  return document.querySelector('.rbc-time-content');
}

export function useEventTouchDrag(configRef: MutableRefObject<DragConfig>) {
  const dragRef = useRef<ActiveDrag | null>(null);
  const justDraggedRef = useRef(false);
  const [preview, setPreview] = useState<DragPreview | null>(null);

  const computeTarget = useCallback(
    (drag: ActiveDrag, clientX: number, clientY: number): Target | null => {
      const config = configRef.current;
      const content = timeContent();
      if (!content) return null;

      const rangeMinutes = (config.dayEndHour - config.dayStartHour) * 60;
      if (rangeMinutes <= 0) return null;

      const rect = content.getBoundingClientRect();
      const pxPerMinute = content.scrollHeight / rangeMinutes;
      const durationMinutes = (drag.event.end.getTime() - drag.event.start.getTime()) / 60000;
      const topY = clientY - drag.grabOffsetY;
      const offsetY = topY - rect.top + content.scrollTop;

      let minute =
        Math.round((config.dayStartHour * 60 + offsetY / pxPerMinute) / STEP_MINUTES) * STEP_MINUTES;
      minute = Math.max(
        config.dayStartHour * 60,
        Math.min(config.dayEndHour * 60 - durationMinutes, minute),
      );

      let doctorId = drag.event.resource.doctorId;
      if (config.showResources) {
        const columns = Array.from(content.querySelectorAll<HTMLElement>('.rbc-day-slot'));
        if (columns.length === config.resources.length) {
          const index = columns.findIndex((column) => {
            const columnRect = column.getBoundingClientRect();
            return clientX >= columnRect.left && clientX <= columnRect.right;
          });
          if (index >= 0) doctorId = config.resources[index].id;
        }
      }

      const start = new Date(config.date);
      start.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60000);
      return { start, end, doctorId, label: `${pad(start.getHours())}:${pad(start.getMinutes())}` };
    },
    [configRef],
  );

  const start = useCallback(
    (event: CalendarEvent, pointerEvent: PointerEvent) => {
      if (dragRef.current) return;

      const node = (pointerEvent.currentTarget as HTMLElement).closest<HTMLElement>('.rbc-event');
      const grabOffsetY = node ? pointerEvent.clientY - node.getBoundingClientRect().top : 0;
      const active: ActiveDrag = {
        event,
        pointerId: pointerEvent.pointerId,
        startX: pointerEvent.clientX,
        startY: pointerEvent.clientY,
        grabOffsetY,
        dragging: false,
        node,
        target: null,
      };

      const preventTouch = (touchEvent: TouchEvent) => touchEvent.preventDefault();

      const onMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== active.pointerId) return;

        if (!active.dragging) {
          const moved = Math.hypot(moveEvent.clientX - active.startX, moveEvent.clientY - active.startY);
          if (moved <= MOVE_THRESHOLD) return;
          active.dragging = true;
          node?.classList.add('rbc-touch-dragging');
          window.addEventListener('touchmove', preventTouch, { passive: false });
        }

        moveEvent.preventDefault();

        const content = timeContent();
        if (content) {
          const rect = content.getBoundingClientRect();
          if (moveEvent.clientY < rect.top + EDGE) content.scrollTop -= AUTO_SCROLL;
          else if (moveEvent.clientY > rect.bottom - EDGE) content.scrollTop += AUTO_SCROLL;
        }

        const target = computeTarget(active, moveEvent.clientX, moveEvent.clientY);
        active.target = target;
        if (target) setPreview({ x: moveEvent.clientX, y: moveEvent.clientY, label: target.label });
      };

      const onUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== active.pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('touchmove', preventTouch);
        node?.classList.remove('rbc-touch-dragging');
        dragRef.current = null;
        setPreview(null);

        if (active.dragging && active.target) {
          justDraggedRef.current = true;
          window.setTimeout(() => {
            justDraggedRef.current = false;
          }, 400);
          configRef.current.onDrop({
            event: active.event,
            start: active.target.start,
            end: active.target.end,
            doctorId: active.target.doctorId,
          });
        }
      };

      dragRef.current = active;
      try {
        (pointerEvent.currentTarget as HTMLElement).setPointerCapture(pointerEvent.pointerId);
      } catch {
        void 0;
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [computeTarget, configRef],
  );

  return { start, preview, justDraggedRef };
}
