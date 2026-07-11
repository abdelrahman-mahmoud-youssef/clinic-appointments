'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Appointment, rescheduleAppointment, RescheduleAppointmentInput } from '@/lib/api/appointments';

// Optimistic drag-and-drop reschedule: the event moves immediately in the UI,
// then rolls back to its exact pre-drag position if the API rejects it (409
// overlap, 422 unavailable) — the same validation as create, just reached via
// PATCH .../reschedule instead of POST. Snapshotting and restoring the whole
// cache (rather than recomputing the old position by hand) guarantees the
// rollback is exact, not an approximation.
export function useRescheduleAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RescheduleAppointmentInput) => rescheduleAppointment(input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'], exact: false });

      const previousQueries = queryClient.getQueriesData<Appointment[]>({ queryKey: ['appointments'] });

      queryClient.setQueriesData<Appointment[]>({ queryKey: ['appointments'] }, (old) =>
        Array.isArray(old)
          ? old.map((appointment) =>
              appointment.id === input.id
                ? { ...appointment, startsAt: input.startsAt, endsAt: input.endsAt }
                : appointment,
            )
          : old,
      );

      return { previousQueries };
    },

    onError: (_error, _input, context) => {
      context?.previousQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'], exact: false });
    },
  });
}
