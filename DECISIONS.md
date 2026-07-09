# DECISIONS

Why each non-obvious choice was made. Newest at the bottom.

## Scaffold

- **Hand-rolled the NestJS app instead of `nest new`.** The generator assumes it
  owns the repo (own git init, own lockfile, own tsconfig chain) and fights pnpm
  monorepos; most of its output would be deleted anyway.
- **`@clinic/shared` builds to `dist/` and is consumed as a normal package
  (`workspace:*`)** rather than tsconfig path aliases. Plain `tsc`/`nest build`
  resolves it with zero runtime path-mapping machinery.

## Double-booking correctness: raw-SQL exclusion constraint

- **Why raw SQL, not schema.prisma:** Prisma has no syntax for
  `EXCLUDE USING gist (...)`. It's added as a hand-written
  `add_no_double_booking_constraint` migration on top of the Prisma-generated
  `init` migration (which creates the plain tables/enums/FKs). Prisma migration
  history tolerates hand-written SQL as long as it lives in its own migration
  folder — `migrate dev`/`deploy` just replay files in timestamp order.
- **Why this is the source of truth, not an app-level check:** a check-then-
  insert in application code has a race window between the read and the write;
  two concurrent requests can both pass the check and both insert. The
  constraint makes Postgres itself the arbiter — under real concurrency,
  exactly one of two conflicting inserts commits and the other errors
  (`conflicting key value violates exclusion constraint`), no matter how the
  requests interleave. App-level overlap checks (in `domain/overlap.ts`) stay
  purely for a friendly 409 in the common, non-racing case.
- **`startsAt`/`endsAt` are `@db.Timestamptz(3)`, not Prisma's default
  `TIMESTAMP`.** First attempt used plain `DateTime` (maps to `TIMESTAMP`,
  i.e. no time zone). The constraint's `tstzrange("startsAt", "endsAt")`
  then requires an implicit cast to `timestamptz`, and that cast depends on
  the session's `TimeZone` setting — so Postgres rejects it with "functions
  in index expression must be marked IMMUTABLE" (it can't guarantee a stable
  ordering for the index otherwise). `@db.Timestamptz(3)` stores the
  timezone-aware value directly, matches CLAUDE.md rule 7 (UTC timestamps,
  not strings), and was applied to every `DateTime` column for consistency,
  not just the two the constraint touches.
- The constraint's partial `WHERE` excludes **both CANCELLED and NO_SHOW** — the
  terminal, non-blocking states. A cancelled or no-show slot is bookable again;
  SCHEDULED/CONFIRMED/COMPLETED rows keep blocking their time range.
- **Verified by hand** (see PR/commit history for the raw psql output): two
  overlapping inserts for the same clinic+doctor — second rejected; two
  back-to-back inserts (10:00-10:30, 10:30-11:00) — both succeed; same slot,
  different doctor, same clinic — both succeed; same slot+doctor after the
  first is CANCELLED — rebooking succeeds.

## Auth: no refresh tokens

- **Deliberately out of scope for this take-home.** `POST /auth/login` issues
  a single JWT (12h expiry, `sub`/`clinicId`/`role` payload) with no refresh
  or rotation mechanism. A real deployment needs short-lived access tokens
  plus a refresh flow (and a revocation story); building that adds real
  surface area — a token store, rotation logic, revocation on
  logout/password-change — for a requirement nobody asked for here. Noted so
  it isn't mistaken for an oversight.

## Auth: clinicId and role come from the JWT payload, not re-derived from the DB

- `JwtStrategy.validate()` re-fetches the user by `payload.sub` to confirm
  they still exist (a deleted/deactivated account fails closed), but the
  `clinicId` and `role` attached to `req.user` come from the signed token
  itself, not the freshly-queried row. The token is the tenancy boundary
  (CLAUDE.md rule 3) — it's cryptographically signed at login time from the
  user's actual clinic/role, so trusting its claims for the lifetime of the
  token is the point. `doctorId` isn't in the payload (JWT scope is
  intentionally minimal) so it's the one field read fresh from the DB lookup.

## Auth: role matrix (enforcement lands with the appointments module)

Recorded now, enforced later via `@Roles()` on appointment routes:
- **ADMIN** — anything within their clinic.
- **RECEPTIONIST** — create, reschedule, list.
- **DOCTOR** — change status on their own appointments (matched via the
  `doctorId` on `req.user`), view.

## Auth: constant-time login

- `login()` always runs `bcrypt.compare` (against a dummy hash when the email is unknown) so response time doesn't leak which emails are registered.

## Auth: ConfigModule for environment variables

- Added `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true })`) rather
  than a native-flag or hand-rolled dotenv approach. `JWT_SECRET` is the
  first env var actually consumed by application code at runtime (previously
  `DATABASE_URL` only mattered to the Prisma CLI). Node's native
  `--env-file` flag would need threading through `nest start --watch`'s
  spawned process and through `pnpm --filter` on Windows — fragile across
  dev/build/start. `@nestjs/config` is the standard NestJS answer: one
  dependency, works identically everywhere, `ConfigService.getOrThrow()`
  fails fast at boot instead of booting with an undefined secret.

## Appointments: doctor availability is a stub behind a clean seam

- `DoctorsModule`/`AvailabilityService.isDoctorAvailable()` always returns
  `true` — no working-hours, time-off, or existing-booking logic yet. It's a
  real injected class, not a TODO comment or an inline `true`, so
  `AppointmentsService` already calls it in the right place (before the
  overlap check, on both create and reschedule) and the real
  implementation drops in behind the same method signature later with zero
  changes to `AppointmentsService` or its call sites.

## Appointments: cross-clinic doctorId/patientId rejected on create

- Beyond the literal spec: `create()` verifies `doctorId` and `patientId`
  belong to the caller's `clinicId` before doing anything else. A Prisma
  foreign key only proves the row exists, not that it belongs to this
  clinic — without this check a receptionist could book an appointment
  "in their clinic" against another clinic's doctor or patient, a real
  tenancy hole rule 3/4 exist to prevent. Reuses `CrossTenantAccessError`
  rather than adding a new domain error class for a case CLAUDE.md's
  exhaustive list didn't enumerate.

## Appointments: DOCTOR-must-own-the-appointment reuses CrossTenantAccessError

- `changeStatus()` rejects a DOCTOR actor whose `doctorId` doesn't match
  the appointment's doctor. This isn't literally cross-*tenant* (same
  clinic, wrong doctor), but no domain error in CLAUDE.md's list fits
  better, and adding a narrow new class for one call site would be
  scope creep. `RolesGuard` only checks role membership (DOCTOR/ADMIN can
  call the route); resource-level ownership is a business rule, so it
  lives in the service, not the guard.
