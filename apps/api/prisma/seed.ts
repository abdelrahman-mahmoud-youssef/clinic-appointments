import { AppointmentStatus, Doctor, Patient, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SEED_PASSWORD = 'Password123!';
const WEEKDAYS = [1, 2, 3, 4, 5];

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
    timezone: 'America/New_York',
    dayStartHour: 8,
    dayEndHour: 18,
    doctors: [
      { name: 'Dr. Alice Chen', startTime: '09:00', endTime: '17:00' },
      { name: 'Dr. Bob Martinez', startTime: '08:00', endTime: '14:00' },
    ],
    patients: ['John Doe', 'Jane Roe', 'Sam Patel', 'Maria Garcia'],
  },
  {
    name: 'Downtown Clinic',
    slug: 'downtown-clinic',
    timezone: 'Europe/London',
    dayStartHour: 9,
    dayEndHour: 17,
    doctors: [
      { name: 'Dr. Carol Ahmed', startTime: '09:00', endTime: '16:00' },
      { name: 'Dr. David Okafor', startTime: '10:00', endTime: '17:00' },
    ],
    patients: ['Emma Wilson', 'Liam Brown', 'Olivia Jones'],
  },
];

function upcomingWeekday(index: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  let found = 0;
  for (let step = 0; step < 21; step += 1) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day >= 1 && day <= 5) {
      if (found === index) return new Date(date);
      found += 1;
    }
  }
  return date;
}

function slotAt(day: Date, hour: number, minute: number): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(day);
  startsAt.setUTCHours(hour, minute, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  return { startsAt, endsAt };
}

async function seedAppointments(
  clinicId: string,
  doctors: Doctor[],
  patients: Patient[],
  createdBy: string,
): Promise<void> {
  const dayOne = upcomingWeekday(0);
  const dayTwo = upcomingWeekday(1);

  const plan = [
    { day: dayOne, hour: 12, minute: 0, doctor: 0, patient: 0, status: AppointmentStatus.SCHEDULED, reason: 'Annual check-up' },
    { day: dayOne, hour: 12, minute: 0, doctor: 1, patient: 1, status: AppointmentStatus.CONFIRMED, reason: 'Consultation' },
    { day: dayOne, hour: 13, minute: 30, doctor: 0, patient: 2, status: AppointmentStatus.SCHEDULED, reason: 'Follow-up' },
    { day: dayTwo, hour: 12, minute: 30, doctor: 1, patient: 0, status: AppointmentStatus.CONFIRMED, reason: 'Blood test review' },
    { day: dayTwo, hour: 14, minute: 0, doctor: 0, patient: 1, status: AppointmentStatus.CANCELLED, reason: 'Rescheduled by patient' },
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
        data: WEEKDAYS.map((weekday) => ({
          clinicId: clinic.id,
          doctorId: doctor.id,
          weekday,
          startTime: doctorSeed.startTime,
          endTime: doctorSeed.endTime,
        })),
      });
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
    const doctorUser = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        email: `doctor@${seed.slug}.test`,
        hashedPassword,
        role: Role.DOCTOR,
        doctorId: doctors[0].id,
      },
    });

    await seedAppointments(clinic.id, doctors, patients, admin.id);

    credentials.push(
      { clinic: seed.name, role: 'ADMIN', email: admin.email, password: SEED_PASSWORD },
      { clinic: seed.name, role: 'RECEPTIONIST', email: receptionist.email, password: SEED_PASSWORD },
      { clinic: seed.name, role: 'DOCTOR', email: doctorUser.email, password: SEED_PASSWORD },
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
