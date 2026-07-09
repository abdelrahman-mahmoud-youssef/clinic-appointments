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

## UTC timestamps, not date+time strings

- `startsAt`/`endsAt` (and every other timestamp column) are stored as
  `@db.Timestamptz(3)`, populated from ISO 8601 strings validated at the
  DTO boundary (`@IsISO8601()`) and converted to `Date` before touching the
  service layer. A "date + time-of-day string" representation (e.g.
  separate `date: "2026-07-10"` and `time: "14:00"` fields, or a naive
  timestamp with no offset) pushes timezone interpretation to whoever
  reads the field next, and different readers can disagree. A single UTC
  instant has one unambiguous meaning everywhere: in Postgres, in the API
  response, and in the browser (which then renders it in local time —
  see the frontend timezone-display decision below for where that
  simplification currently stops).
- This isn't just a style preference here: the exclusion constraint's
  `tstzrange("startsAt", "endsAt")` *requires* a timezone-aware column to
  even create the index (see the immutability error described above) —
  so UTC timestamps aren't only cleaner, they're a precondition for the
  double-booking guarantee working at all.

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

- `login()` always runs `bcrypt.compare` — against the real user's hash
  when the email exists, against a fixed dummy hash when it doesn't — so
  both cases take the same amount of time and return the identical
  generic "Invalid email or password" message. Without this, skipping the
  (deliberately slow) bcrypt call on a missing user makes that response
  measurably faster than a wrong-password response, which lets an
  attacker enumerate which emails are registered purely by timing the
  endpoint. This was caught and fixed as its own review pass, not written
  correctly the first time — worth noting because it's an easy thing to
  miss: the code "looks" secure (bcrypt, generic error message) while
  still leaking through a side channel.

## The status state machine

```
SCHEDULED  -> CONFIRMED | CANCELLED
CONFIRMED  -> COMPLETED | CANCELLED | NO_SHOW
COMPLETED, CANCELLED, NO_SHOW -> terminal
```

- The transition table (`ALLOWED_TRANSITIONS`) lives in `packages/shared`,
  not duplicated between the API and the web app. The API's
  `assertValidTransition()` wraps it to throw
  `InvalidStatusTransitionError` (422) on an illegal move; the web app's
  status control reads the identical table via `getAllowedNextStatuses()`
  to decide which action buttons to show. One source of truth means the
  UI can never offer a transition the backend would reject, and the two
  can't quietly drift apart as the table changes.
- It's a plain object literal, not a state-machine library — five states,
  a handful of edges, no hierarchical/parallel states, no need for
  anything heavier. `isTerminalStatus()` (derived from the same table:
  a state with zero allowed next states is terminal) is what the
  reschedule flow uses to reject rescheduling a
  completed/cancelled/no-show appointment.
- Deliberately a pure function with no I/O: given a current and a
  requested status, it either does nothing or throws — trivially unit
  tested without mocks, and safe to call before touching the database in
  `changeStatus()`, so an illegal transition never reaches a write.

## Auth: ConfigModule for environment variables

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

## Tests: jest config split, unit vs integration

- Two configs: `jest.config.js` (default, `pnpm test`) runs `*.spec.ts`
  excluding `*.integration.spec.ts` — fast, no DB, safe to run anytime.
  `jest.integration.config.js` (`pnpm test:integration`) runs only
  `*.integration.spec.ts`, with `--runInBand` so multiple integration spec
  files (if more are added later) don't run as concurrent workers against
  the same live database and interfere with each other.
- Both configs set `setupFiles: ['reflect-metadata']` — `@Injectable()`
  classes get imported transitively by test files, and the decorator
  metadata polyfill needs to load before that happens.
- `test:integration` is `node --env-file=.env node_modules/jest/bin/jest.js
  ...` rather than going through `@nestjs/config`: these tests instantiate
  `PrismaClient`/`AppointmentsRepository` directly (no Nest app bootstrap,
  matching the testing skill's "no TestingModule for service tests"
  guidance), so nothing loads `.env` unless something does it explicitly.
  Node's native `--env-file` flag is the plain, zero-dependency fit here —
  no `nest start --watch` child-process spawning to fight, unlike the
  earlier `ConfigModule` vs. native-flag tradeoff.
- Integration tests run against the **same** dev Postgres from
  docker-compose, not a separate test database — no new service, no extra
  provisioning. Each test file creates its own dedicated throwaway
  clinics/doctors/patients in `beforeAll`, cleans up appointments in
  `afterEach`, and deletes everything in `afterAll`, so it never touches
  the seeded dev data and is safe to re-run repeatedly.

## Bug found by the concurrency test: deadlock is also a double-booking signal

- The true-concurrency integration test (`Promise.allSettled` on two
  simultaneous overlapping `create()` calls) was **flaky** against the
  first version of `translateError`: it failed roughly half the time with
  a raw, untranslated `PrismaClientUnknownRequestError` reaching the
  caller instead of `OverlappingAppointmentError`.
- Root cause, confirmed empirically (temporary debug logging, 10
  repeated runs): under real concurrent inserts, Postgres's GiST
  exclusion-constraint check can fail in **two** different ways depending
  on which lock the two transactions contend over first — a clean
  `23P01 conflicting key value violates exclusion constraint` (the shape
  `translateError` already matched), or a `40P01 deadlock detected`
  between the two transactions' index-page locks (a shape it didn't).
  Both mean the exact same thing: the second insert cannot proceed
  because it collides with the first.
- Fix: `translateError` now also matches `deadlock detected` in the
  message text, alongside the constraint name. This is safe specifically
  because `create()`/`update()` each run a single INSERT/UPDATE with no
  other locks in play in the same transaction — a deadlock here can only
  be this race. A future repository method that takes additional locks in
  the same transaction would need to reconsider this before reusing
  `translateError` as-is.
- This is exactly the kind of regression the constraint-translation
  integration test exists to catch — a plausible-looking message-substring
  match that only covers one of the real failure modes. Without a test
  that exercises genuine concurrency (not just a sequential "insert one,
  then try to insert a conflicting one"), this gap would not have surfaced.

## Doctor availability: containment is per-row, not per-union

- `isWithinWorkingHours()` requires the appointment to fall fully inside a
  **single** availability row for that weekday, not the union of the
  doctor's rows for that day. This matches the spec's own framing (split
  shifts) — a doctor working 09:00-12:00 and 13:00-17:00 is genuinely
  unavailable during the 12:00-13:00 gap, so an appointment spanning
  11:30-13:30 is correctly rejected even though 09:00-17:00 is "covered"
  in aggregate. If two rows happen to be back-to-back with no gap, an
  appointment straddling that exact boundary would be (rarely) rejected
  too; merging contiguous rows into a wider window wasn't built since
  nothing asked for it and it adds real interval-merging logic for an
  edge case unlikely to occur in seeded or realistic data.

## Doctor availability: weekday/time compared in UTC, not clinic-local time

- `startsAt`/`endsAt` are stored as UTC timestamps; `isWithinWorkingHours`
  compares their UTC weekday and UTC clock time directly against the
  doctor's `HH:mm` rows, with no conversion through `Clinic.timezone`.
  This is a real simplification, not silently swept under the rug: a
  clinic whose local timezone isn't UTC would have its working-hours
  windows effectively shifted by the UTC offset. Proper IANA-timezone-
  aware conversion (`Intl.DateTimeFormat` with `clinic.timezone`) is a
  legitimately bigger feature — value keyed by a compound
  (weekday, minute-of-day) needs the clinic's civil time, not the
  timestamp's UTC clock time, and DST transitions add real edge cases.
  Not built because it wasn't asked for here; flagging it as a known gap
  rather than a silent decision.

## Doctor availability: Redis client is ioredis

- Chosen over the official `redis` v4+ package because CLAUDE.md's stack
  already lists BullMQ as a planned future piece, and BullMQ requires
  ioredis specifically as its underlying client — picking it now avoids
  two different Redis client libraries coexisting in the project later.
- Critical, easy-to-miss detail: an ioredis client with no listener on its
  `'error'` event throws an **unhandled exception and crashes the Node
  process** the moment the connection fails, regardless of how carefully
  every call site wraps its own commands in try/catch. `RedisModule`
  attaches a `client.on('error', ...)` handler that just logs — without
  it, CLAUDE.md rule 9 ("if Redis is down, correctness still holds") would
  be false in the most dramatic way possible: the whole API would go down
  with Redis, not just get slower.
- `maxRetriesPerRequest: 1` makes individual commands fail fast (so
  `safeRedisCall`'s try/catch returns quickly and falls through to
  Postgres) rather than queuing and hanging while ioredis's own
  reconnection logic runs in the background; `retryStrategy` still lets
  the client keep attempting to reconnect on its own schedule so it
  recovers automatically once Redis comes back.
- Verified live, not just with mocks: booted the API with Redis up,
  confirmed a cache key was populated with the correct TTL and content,
  then stopped the Redis container entirely and re-ran the same three
  HTTP requests (inside working hours, outside working hours, during the
  split-shift lunch gap) — identical correct results both times, with the
  app logging repeated Redis connection warnings but never crashing or
  serving a wrong answer.

## Frontend: hand-rolled Next.js scaffold, no UI framework

- Same reasoning as the API: `create-next-app` fights a pnpm workspace
  (its own git init, lockfile, ESLint config) more than it helps, and
  most of its output would be deleted anyway.
- No Tailwind/component library — plain `globals.css` with a handful of
  reusable classes (`.modal`, `.form-error`, `.status-badge`,
  `.filters-bar`). The API is the graded core; the frontend's job is to
  make the features demonstrable, not to be elaborate, so a styling
  framework's setup cost (config files, a new dependency, a new set of
  conventions to follow correctly) wasn't worth paying for four pages.
- `react-big-calendar` + `date-fns` (its documented localizer dependency)
  for the calendar itself — the one place off-the-shelf really earns its
  keep, since day/week/month views and drag-and-drop are exactly what it
  exists to solve well.

## Frontend: two new backend endpoints and CORS, beyond step 9's literal scope

- `GET /doctors` and `GET /patients` (both clinic-scoped, no DTOs — thin
  read-only lists, same layering as everything else) were added because
  the appointment form and the doctor filter need *something* to
  populate their dropdowns from, and no such endpoint existed. Without
  them the form would need raw UUID text inputs, which would defeat the
  actual point of building a frontend ("make the features demonstrable").
- `app.enableCors()` (default: reflects any origin) was added to
  `main.ts` — without it, every fetch from the web app (a different
  origin/port: 3001 vs the API's 3000) is blocked by the browser before
  it reaches a single controller. Fine for a take-home; a real
  deployment would restrict this to the actual frontend origin(s)
  instead of allowing any.

## Frontend: JWT stored in localStorage, not an httpOnly cookie

- Simpler for a demo app (no cookie-setting endpoint changes, no CSRF
  token handling), but a real tradeoff worth naming: a token in
  localStorage is readable by any JS running on the page, so an XSS bug
  anywhere in the app could exfiltrate it. An httpOnly cookie set by the
  API would close that specific hole at the cost of needing CSRF
  protection instead. Not revisited here since the backend's login
  endpoint already returns a bearer token in the response body (not a
  cookie), matching how it was built in step 5.

## Frontend: no session-expiry handling

- The API issues a 12h JWT with no refresh (see the earlier "Auth: no
  refresh tokens" decision). The frontend doesn't do anything special
  when a request fails with 401 partway through a session — `apiFetch`
  throws an `ApiError` like any other failure, which surfaces as a
  generic error message rather than an automatic redirect to `/login`.
  A production app would want a response interceptor that catches 401
  specifically and forces a re-login. Not built here; noting the gap
  rather than leaving it to be discovered.

## Frontend: no clinic-timezone-aware display

- Same simplification as the backend's availability check (see the
  earlier "Doctor availability: weekday/time compared in UTC" decision):
  `react-big-calendar` is handed plain JS `Date` objects built from the
  API's UTC timestamps, so events render in whatever timezone the
  *browser* is in, not the clinic's own `timezone` field. For a clinic
  staff member sitting in the clinic's own timezone this happens to look
  right by coincidence; it would not for a remote user in a different
  timezone. Proper support needs the same `Intl.DateTimeFormat`-based
  conversion flagged as out of scope on the backend.

## Frontend: no automated test suite

- Verification for every frontend commit was done live in a real browser
  (Playwright driving an actual Chromium instance against the real API,
  Postgres, and Redis — not component tests with mocked fetches),
  documented in each commit message. No Jest/React Testing Library suite
  was added for `apps/web`. Automated backend tests were the explicit
  focus of step 7; the frontend's job per this step was to prove the
  features work, which live end-to-end verification does more directly
  than a mocked unit test would. Revisit if the frontend grows past a
  handful of pages.

## Frontend: broad, unscoped query invalidation after mutations

- Every mutation (create, reschedule, status change) invalidates the
  entire `['appointments']` query key space (`exact: false`) rather than
  only the specific range/filter combination affected. Simpler than
  computing which cached views could contain the changed appointment,
  and at this app's scale (a handful of cached ranges per session) the
  extra refetches are not a meaningful cost. A busier app with many
  simultaneously-open views would want more targeted invalidation.

## What I deliberately left out, and why

These are scope decisions, not gaps I didn't notice. Each was weighed
against what this project needs to prove and left out because building
it would add real surface area for a requirement nobody asked for here.

- **Refresh tokens.** `POST /auth/login` issues one 12h JWT with no
  refresh or rotation flow (full reasoning in "Auth: no refresh tokens"
  above). A real deployment needs short-lived access tokens, a refresh
  endpoint, and a revocation story for logout/password-change. That's a
  second auth subsystem's worth of work for a take-home whose auth
  requirement is "prove the tenancy boundary holds," not "build
  production session management."
- **Full RBAC granularity.** Roles are a fixed three-value enum
  (`ADMIN`/`RECEPTIONIST`/`DOCTOR`) checked via `@Roles()` plus one
  service-level ownership rule (a DOCTOR can only act on their own
  appointments). There's no permission table, no custom roles, no
  per-resource ACLs, no admin UI for managing any of that. The role
  matrix in CLAUDE.md is small and fully enumerable; a generic
  permissions system would be solving a problem this project doesn't
  have, at the cost of every route needing to consult a runtime
  permissions store instead of a compile-time-checked decorator.
- **Microservices, CQRS/event-sourcing, GraphQL, hexagonal
  ports-and-adapters.** None of these solve a problem this module
  actually has — one bounded domain (appointments), one write model, one
  small set of clients (a receptionist calendar and, eventually,
  whatever else calls this API). Each of these patterns pays for itself
  at a scale or complexity this project doesn't operate at; adding any of
  them here would be optimizing for a hypothetical future system, not
  the one that exists. (This mirrors CLAUDE.md's own "what we
  deliberately do NOT build" list — repeated here because a reviewer
  skimming this file shouldn't have to cross-reference another one to
  find it.)
- **A separate integration test database.** Integration tests run
  against the same dev Postgres from `docker-compose`, not a dedicated
  `clinic_test` database or container (full reasoning in "Tests: jest
  config split" above). Each test file provisions and tears down its own
  throwaway clinic/doctor/patient fixtures, so there's no isolation
  benefit a second database would add here that per-test fixtures don't
  already provide — and a second database is one more thing to keep
  migrated and in sync.
- **The BullMQ worker.** Not built. CLAUDE.md's stack list mentions BullMQ
  for background jobs (e.g. appointment reminders), but no such job is
  part of this project's actual requirements — a queue and worker process
  with nothing concrete to run through it is speculative infrastructure,
  not a feature, and this project doesn't build speculative infrastructure
  (see "no over-engineering" throughout this file). Redis is already a
  real dependency here (`RedisModule`, `AvailabilityService`'s cache, the
  graceful-degradation handling), so BullMQ would be additive — a new
  module, not a restructure — the day an actual job needs it. Until then,
  it's out of scope by design, not an unfinished corner of this one.
