import { AppointmentStatus, Doctor, Patient, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SEED_PASSWORD = 'Password123!';
const WORK_DAYS = [0, 1, 2, 3, 4];

interface DoctorSeed {
  name: string;
  startTime: string;
  endTime: string;
}

interface ClinicSeed {
  name: string;
  slug: string;
  timezone: string;
  dayStartHour: number;
  dayEndHour: number;
  doctors: DoctorSeed[];
  patients: string[];
}

const CLINICS: ClinicSeed[] = [
  {
    name: 'Sunrise Clinic',
    slug: 'sunrise-clinic',
    timezone: 'Africa/Cairo',
    dayStartHour: 9,
    dayEndHour: 21,
    doctors: [
      { name: 'Dr. Ahmed Hassan', startTime: '10:00', endTime: '18:00' },
      { name: 'Dr. Mona Saleh', startTime: '12:00', endTime: '20:00' },
    ],
    patients: ['Omar Ali', 'Fatma Ibrahim', 'Khaled Mostafa', 'Nour Adel'],
  },
  {
    name: 'Downtown Clinic',
    slug: 'downtown-clinic',
    timezone: 'Africa/Cairo',
    dayStartHour: 9,
    dayEndHour: 21,
    doctors: [
      { name: 'Dr. Youssef Nabil', startTime: '10:00', endTime: '16:00' },
      { name: 'Dr. Salma Fouad', startTime: '13:00', endTime: '20:00' },
    ],
    patients: ['Hana Mahmoud', 'Tarek Sami', 'Laila Hosny'],
  },
];

function upcomingWorkday(index: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  let found = 0;
  for (let step = 0; step < 21; step += 1) {
    date.setDate(date.getDate() + 1);
    if (WORK_DAYS.includes(date.getDay())) {
      if (found === index) return new Date(date);
      found += 1;
    }
  }
  return date;
}

function pastWorkday(index: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  let found = 0;
  for (let step = 0; step < 21; step += 1) {
    date.setDate(date.getDate() - 1);
    if (WORK_DAYS.includes(date.getDay())) {
      if (found === index) return new Date(date);
      found += 1;
    }
  }
  return date;
}

function slotAt(day: Date, hour: number, minute: number): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(day);
  startsAt.setHours(hour, minute, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  return { startsAt, endsAt };
}

function doctorEmailLocalPart(name: string): string {
  return name
    .replace(/^Dr\.?\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
}

async function seedAppointments(
  clinicId: string,
  doctors: Doctor[],
  patients: Patient[],
  createdBy: string,
): Promise<void> {
  const past2 = pastWorkday(1);
  const past1 = pastWorkday(0);
  const day0 = upcomingWorkday(0);
  const day1 = upcomingWorkday(1);
  const day2 = upcomingWorkday(2);
  const day3 = upcomingWorkday(3);

  const plan = [
    { day: past2, hour: 11, minute: 0, doctor: 0, patient: 0, status: AppointmentStatus.COMPLETED, reason: 'Annual check-up' },
    { day: past2, hour: 11, minute: 0, doctor: 1, patient: 1, status: AppointmentStatus.COMPLETED, reason: 'Consultation' },
    { day: past2, hour: 14, minute: 0, doctor: 0, patient: 2, status: AppointmentStatus.NO_SHOW, reason: 'Follow-up' },
    { day: past1, hour: 12, minute: 0, doctor: 1, patient: 0, status: AppointmentStatus.COMPLETED, reason: 'Blood test review' },
    { day: past1, hour: 15, minute: 0, doctor: 0, patient: 1, status: AppointmentStatus.COMPLETED, reason: 'Physiotherapy' },
    { day: day0, hour: 11, minute: 0, doctor: 0, patient: 0, status: AppointmentStatus.CONFIRMED, reason: 'Annual check-up' },
    { day: day0, hour: 14, minute: 0, doctor: 0, patient: 2, status: AppointmentStatus.SCHEDULED, reason: 'Lab results' },
    { day: day0, hour: 14, minute: 0, doctor: 1, patient: 1, status: AppointmentStatus.CONFIRMED, reason: 'Consultation' },
    { day: day0, hour: 16, minute: 0, doctor: 1, patient: 0, status: AppointmentStatus.SCHEDULED, reason: 'Vaccination' },
    { day: day1, hour: 12, minute: 0, doctor: 0, patient: 1, status: AppointmentStatus.SCHEDULED, reason: 'Skin check' },
    { day: day1, hour: 13, minute: 0, doctor: 1, patient: 2, status: AppointmentStatus.CONFIRMED, reason: 'Follow-up' },
    { day: day1, hour: 15, minute: 0, doctor: 0, patient: 0, status: AppointmentStatus.CANCELLED, reason: 'Rescheduled by patient' },
    { day: day2, hour: 11, minute: 0, doctor: 1, patient: 1, status: AppointmentStatus.SCHEDULED, reason: 'Consultation' },
    { day: day2, hour: 13, minute: 0, doctor: 0, patient: 2, status: AppointmentStatus.CONFIRMED, reason: 'Blood pressure review' },
    { day: day3, hour: 10, minute: 0, doctor: 0, patient: 1, status: AppointmentStatus.SCHEDULED, reason: 'New patient intake' },
    { day: day3, hour: 15, minute: 0, doctor: 1, patient: 0, status: AppointmentStatus.CONFIRMED, reason: 'Follow-up' },
  ];

  for (const item of plan) {
    const { startsAt, endsAt } = slotAt(item.day, item.hour, item.minute);
    await prisma.appointment.create({
      data: {
        clinicId,
        doctorId: doctors[item.doctor].id,
        patientId: patients[item.patient].id,
        startsAt,
        endsAt,
        status: item.status,
        reason: item.reason,
        createdBy,
        updatedBy: createdBy,
      },
    });
  }
}

async function main() {
  await prisma.appointment.deleteMany();
  await prisma.doctorAvailability.deleteMany();
  await prisma.user.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.clinic.deleteMany();

  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);
  const credentials: Array<{ clinic: string; role: string; email: string; password: string }> = [];

  for (const seed of CLINICS) {
    const clinic = await prisma.clinic.create({
      data: {
        name: seed.name,
        timezone: seed.timezone,
        dayStartHour: seed.dayStartHour,
        dayEndHour: seed.dayEndHour,
      },
    });

    const doctors: Doctor[] = [];
    for (const doctorSeed of seed.doctors) {
      const doctor = await prisma.doctor.create({
        data: { clinicId: clinic.id, name: doctorSeed.name },
      });
      await prisma.doctorAvailability.createMany({
        data: WORK_DAYS.map((weekday) => ({
          clinicId: clinic.id,
          doctorId: doctor.id,
          weekday,
          startTime: doctorSeed.startTime,
          endTime: doctorSeed.endTime,
        })),
      });

      const email = `${doctorEmailLocalPart(doctorSeed.name)}@${seed.slug}.test`;
      await prisma.user.create({
        data: { clinicId: clinic.id, email, hashedPassword, role: Role.DOCTOR, doctorId: doctor.id },
      });
      credentials.push({ clinic: seed.name, role: 'DOCTOR', email, password: SEED_PASSWORD });

      doctors.push(doctor);
    }

    const patients: Patient[] = [];
    for (const name of seed.patients) {
      patients.push(await prisma.patient.create({ data: { clinicId: clinic.id, name } }));
    }

    const admin = await prisma.user.create({
      data: { clinicId: clinic.id, email: `admin@${seed.slug}.test`, hashedPassword, role: Role.ADMIN },
    });
    const receptionist = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        email: `receptionist@${seed.slug}.test`,
        hashedPassword,
        role: Role.RECEPTIONIST,
      },
    });

    await seedAppointments(clinic.id, doctors, patients, admin.id);

    credentials.push(
      { clinic: seed.name, role: 'ADMIN', email: admin.email, password: SEED_PASSWORD },
      { clinic: seed.name, role: 'RECEPTIONIST', email: receptionist.email, password: SEED_PASSWORD },
    );
  }

  console.log('\nSeeded login credentials:\n');
  console.table(credentials);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
