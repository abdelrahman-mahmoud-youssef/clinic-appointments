# Clinic Appointments

A multi-clinic (multi-tenant) appointment management system: a NestJS +
Prisma + PostgreSQL API, a Next.js calendar frontend, and Redis as a caching
layer. Built as an interview take-home, with one non-negotiable: **two
requests can never double-book the same doctor into overlapping time slots,
even under real concurrency** — enforced at the database level, not just in
application code. See [Double-booking correctness](#double-booking-correctness-the-headline)
below for how and why.

## Quickstart

Requires Docker, Node 20+, and pnpm.

```bash
# 1. Start Postgres and Redis
docker compose up -d

# 2. Install dependencies (installs api, web, and the shared package)
pnpm install

# 3. Configure the API's environment
cp apps/api/.env.example apps/api/.env

# 4. Apply migrations (creates tables + the double-booking exclusion constraint)
pnpm --filter @clinic/api exec prisma migrate deploy

# 5. Seed two clinics with users, doctors, patients, and working hours
pnpm --filter @clinic/api exec prisma db seed

# 6. Run both apps together from the repo root
pnpm dev   # API on http://localhost:3000, web on http://localhost:3001
```

(Or run them separately in two terminals with `pnpm --filter @clinic/api dev`
and `pnpm --filter @clinic/web dev`, if you want their logs apart.)

Open http://localhost:3001 and log in with any of the seeded accounts
(password for all of them is `Password123!`):

| Clinic          | Role         | Email                              |
| ---------------- | ------------ | ----------------------------------- |
| Sunrise Clinic  | Admin        | `admin@sunrise-clinic.test`         |
| Sunrise Clinic  | Receptionist | `receptionist@sunrise-clinic.test`  |
| Sunrise Clinic  | Doctor       | `doctor@sunrise-clinic.test`        |
| Downtown Clinic | Admin        | `admin@downtown-clinic.test`        |
| Downtown Clinic | Receptionist | `receptionist@downtown-clinic.test` |
| Downtown Clinic | Doctor       | `doctor@downtown-clinic.test`       |

Two clinics exist specifically so you can confirm cross-tenant isolation:
data created in one is invisible to and unreachable from the other. Each
clinic seeds two doctors — one with a Mon–Fri split shift (09:00–12:00,
13:00–17:00) and one with a single Mon–Fri block (09:00–17:00) — so the
availability check has real working hours to enforce.

## Running the tests

```bash
# Unit tests: pure domain functions + services with mocked repositories.
# No database required.
pnpm --filter @clinic/api test

# Integration tests: real Postgres, including the concurrency race.
# Requires the postgres container from `docker compose up -d` to be running.
pnpm --filter @clinic/api run test:integration
```

The integration suite creates its own throwaway clinics/doctors/patients per
run and tears them down afterward, so it's safe to re-run repeatedly and
never touches the seeded demo data.

## Architecture

Standard NestJS layering, applied consistently across every feature module
(`appointments`, `auth`, `doctors`, `patients`):

```
controller  → thin: extract request data, delegate, return. No logic.
service     → business rules and orchestration. Never touches Prisma directly.
repository  → every Prisma query for that module. No business logic.
domain/     → pure functions (no Nest, no Prisma, no I/O). Unit-tested directly.
```

The two places this matters most:

- **`appointments/domain/overlap.ts`** — the collision predicate
  (`newStart < existingEnd && newEnd > existingStart`) as a pure function,
  reused conceptually by both the app-level pre-check and the database
  constraint below.
- **`appointments/domain/appointment-status.machine.ts`** — the status
  state machine. The transition table itself lives in `packages/shared`
  (see [The status state machine](./DECISIONS.md#the-status-state-machine))
  so the API's enforcement and the web app's "only show legal actions" UI
  can never drift apart.

Tenancy: `clinicId` is read exclusively from the JWT payload via an
`@ClinicId()` param decorator, never from the request body or URL params.
Every repository query is scoped by it. See
[clinicId from the JWT](./DECISIONS.md#auth-clinicid-and-role-come-from-the-jwt-payload-not-re-derived-from-the-db).

Cross-cutting concerns use the matching NestJS primitive: `RolesGuard` and
`JwtAuthGuard` for access control, a global `DomainExceptionFilter` for
mapping domain errors to HTTP status codes, `class-validator` DTOs at the
controller boundary. Domain exceptions (`OverlappingAppointmentError`,
`InvalidStatusTransitionError`, `DoctorUnavailableError`,
`CrossTenantAccessError`) carry no knowledge of HTTP — the filter owns that
mapping.

`packages/shared` holds the `AppointmentStatus`/`Role` enums and the status
transition table, consumed by both `apps/api` and `apps/web` so tenancy
rules, role names, and legal status transitions have exactly one source of
truth instead of two hand-maintained copies.

Full reasoning for every non-obvious choice — including the ones this
README only summarizes — is in [`DECISIONS.md`](./DECISIONS.md).

## Double-booking correctness (the headline)

The guarantee: **it is impossible for two active appointments for the same
doctor to overlap, no matter how requests interleave.** This is enforced by
a Postgres exclusion constraint, not application code:

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

**Why the database, not a check-then-insert in the service layer:** an
application-level "check for conflicts, then insert" has a race window
between the read and the write. Two concurrent requests can both read "no
conflict" and both insert — the check is only ever a snapshot, never a
guarantee. The exclusion constraint makes Postgres itself the arbiter at
insert time: under real concurrency, exactly one of two conflicting inserts
commits and the other errors, regardless of timing. The app-level overlap
check in `domain/overlap.ts` still runs first — it exists purely to turn
the common, non-racing case into a friendly `409`, not to provide the
actual guarantee.

**The two-part failure mode this project's tests specifically caught:**
under genuine concurrent inserts (proven with a `Promise.allSettled` race in
the integration suite, not a sequential "insert one, then try to insert a
conflicting one"), Postgres's GiST index can reject the second insert two
different ways depending on which internal lock the two transactions
contend over first:

- a clean `23P01 conflicting key value violates exclusion constraint`, or
- a `40P01 deadlock detected` between the two transactions' index-page
  locks — which means the exact same thing (a genuine double-booking
  collision), just surfacing through Postgres's deadlock detector instead
  of the constraint check.

The first version of this project's error-translation code only recognized
the first shape, and the concurrency test was measurably flaky as a result
— it failed roughly half the time with a raw, untranslated database error
instead of a clean `409`. The fix (and the reasoning for why matching both
shapes is safe here specifically) is in
[`DECISIONS.md`](./DECISIONS.md#double-booking-correctness-raw-sql-exclusion-constraint).
This is the kind of gap that only a real-concurrency test — not a mocked
unit test — can surface.
