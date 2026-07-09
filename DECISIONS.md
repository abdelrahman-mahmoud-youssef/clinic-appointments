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
