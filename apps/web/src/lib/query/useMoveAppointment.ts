'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Appointment, updateAppointment } from '@/lib/api/appointments';

interface MoveAppointmentInput {
  appointment: Appointment;
  doctorId: string;
  startsAt: string;
  endsAt: string;
}

export function useMoveAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appointment, doctorId, startsAt, endsAt }: MoveAppointmentInput) =>
      updateAppointment(appointment.id, {
        patientId: appointment.patientId,
        doctorId,
        startsAt,
        endsAt,
        reason: appointment.reason ?? undefined,
        notes: appointment.notes ?? undefined,
      }),

    onMutate: async ({ appointment, doctorId, startsAt, endsAt }) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'], exact: false });

      const previousQueries = queryClient.getQueriesData<Appointment[]>({ queryKey: ['appointments'] });

      queryClient.setQueriesData<Appointment[]>({ queryKey: ['appointments'] }, (old) =>
        old?.map((item) =>
          item.id === appointment.id ? { ...item, doctorId, startsAt, endsAt } : item,
        ),
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
