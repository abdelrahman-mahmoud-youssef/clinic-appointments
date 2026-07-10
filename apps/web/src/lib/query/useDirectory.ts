'use client';

import { useQuery } from '@tanstack/react-query';
import { listDoctors } from '@/lib/api/doctors';
import { listPatients } from '@/lib/api/patients';

export function useDirectory() {
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: listDoctors });
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: listPatients });

  const doctorName = (id: string) => doctors.find((doctor) => doctor.id === id)?.name ?? 'Unknown doctor';
  const patientName = (id: string) =>
    patients.find((patient) => patient.id === id)?.name ?? 'Unknown patient';

  return { doctorName, patientName };
}
