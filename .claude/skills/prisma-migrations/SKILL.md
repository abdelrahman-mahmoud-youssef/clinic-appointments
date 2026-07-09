---
name: prisma-migrations
description: How to change the database schema in this repo — Prisma migration workflow, the raw-SQL exclusion constraint, and translating Postgres/Prisma errors into domain exceptions. Use for any schema.prisma change, new migration, or repository-level error handling.
---

# Prisma schema & migrations

## Workflow

1. Edit `apps/api/prisma/schema.prisma`.
2. `pnpm --filter @clinic/api exec prisma migrate dev --name <snake_case_name>`
   (Postgres must be up: `docker compose up -d postgres`).
3. Never edit an already-applied migration. New change = new migration.
4. Constraint SQL that Prisma can't express goes INTO the generated migration
   file as raw SQL — then it travels with `migrate deploy` like everything else.

## The exclusion constraint (source of truth for double-booking)

Prisma cannot declare exclusion constraints. Create the migration with
`--create-only`, then append:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment" ADD CONSTRAINT no_double_booking
EXCLUDE USING gist (
  "clinicId" WITH =,
  "doctorId" WITH =,
  tstzrange("startsAt", "endsAt") WITH &&
)
WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
```

- `tstzrange` is half-open `[)` by default — back-to-back appointments pass.
- The partial WHERE frees cancelled/no-show slots for rebooking.
- After writing it, verify by hand: insert two overlapping rows, expect the
  second to fail with SQLSTATE `23P01`; insert back-to-back rows, expect both
  to succeed.

## Error translation (repository layer only)

Prisma has no error code for exclusion violations — they surface as a driver
error mentioning SQLSTATE `23P01` / the constraint name, not as a tidy
`P2002`. In the repository:

- `23P01` / `no_double_booking` → throw `OverlappingAppointmentError`
- `P2002` (unique) → the matching domain error for that constraint
- `P2025` (record not found) → treat as not-found within clinic scope

Match on the constraint name, not just the SQLSTATE, once there's more than
one exclusion constraint. The service never sees a Prisma error type.

## Schema conventions

- ids: `String @id @default(uuid())`
- timestamps: `DateTime` (Prisma stores timestamptz UTC) — `startsAt`,
  `endsAt`, `createdAt @default(now())`, `updatedAt @updatedAt`
- enums mirror `@clinic/shared` exactly (same names, same values)
- every tenant-owned model has `clinicId` + relation, and an index that leads
  with `clinicId` for its hot query (e.g. `@@index([clinicId, doctorId, startsAt])`)
