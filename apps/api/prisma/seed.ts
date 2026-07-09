import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SEED_PASSWORD = 'Password123!';

const WEEKDAYS_MON_FRI = [1, 2, 3, 4, 5];

async function main() {
  await prisma.appointment.deleteMany();
  await prisma.doctorAvailability.deleteMany();
  await prisma.user.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.clinic.deleteMany();

  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);

  const clinics = await Promise.all([
    prisma.clinic.create({ data: { name: 'Sunrise Clinic', timezone: 'America/New_York' } }),
    prisma.clinic.create({ data: { name: 'Downtown Clinic', timezone: 'Europe/London' } }),
  ]);

  const credentials: Array<{ clinic: string; role: string; email: string; password: string }> = [];

  for (const clinic of clinics) {
    const slug = clinic.name.toLowerCase().replace(/\s+/g, '-');

    const [doctorLinked, doctorExtra] = await Promise.all([
      prisma.doctor.create({ data: { clinicId: clinic.id, name: `Dr. Alice (${clinic.name})` } }),
      prisma.doctor.create({ data: { clinicId: clinic.id, name: `Dr. Bob (${clinic.name})` } }),
    ]);

    // Dr. Alice works a split shift (morning + afternoon, closed for lunch).
    // Dr. Bob works a single block. Both Mon-Fri, demonstrating the two shapes.
    await prisma.doctorAvailability.createMany({
      data: WEEKDAYS_MON_FRI.flatMap((weekday) => [
        { clinicId: clinic.id, doctorId: doctorLinked.id, weekday, startTime: '09:00', endTime: '12:00' },
        { clinicId: clinic.id, doctorId: doctorLinked.id, weekday, startTime: '13:00', endTime: '17:00' },
        { clinicId: clinic.id, doctorId: doctorExtra.id, weekday, startTime: '09:00', endTime: '17:00' },
      ]),
    });

    await Promise.all([
      prisma.patient.create({ data: { clinicId: clinic.id, name: `Patient One (${clinic.name})` } }),
      prisma.patient.create({ data: { clinicId: clinic.id, name: `Patient Two (${clinic.name})` } }),
    ]);

    const [admin, receptionist, doctorUser] = await Promise.all([
      prisma.user.create({
        data: { clinicId: clinic.id, email: `admin@${slug}.test`, hashedPassword, role: Role.ADMIN },
      }),
      prisma.user.create({
        data: {
          clinicId: clinic.id,
          email: `receptionist@${slug}.test`,
          hashedPassword,
          role: Role.RECEPTIONIST,
        },
      }),
      prisma.user.create({
        data: {
          clinicId: clinic.id,
          email: `doctor@${slug}.test`,
          hashedPassword,
          role: Role.DOCTOR,
          doctorId: doctorLinked.id,
        },
      }),
    ]);

    credentials.push(
      { clinic: clinic.name, role: 'ADMIN', email: admin.email, password: SEED_PASSWORD },
      { clinic: clinic.name, role: 'RECEPTIONIST', email: receptionist.email, password: SEED_PASSWORD },
      { clinic: clinic.name, role: 'DOCTOR', email: doctorUser.email, password: SEED_PASSWORD },
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
