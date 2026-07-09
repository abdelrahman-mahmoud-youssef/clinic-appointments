# CLAUDE.md

Project memory for Claude Code. Read this before doing anything in this repo.

## What this project is

An Appointment Management module for a multi-clinic (multi-tenant) medical system.
Built as an interview take-home. The goal is not just "working," it's clean,
senior-level code with correct concurrency handling and no over-engineering.

Stack: NestJS (API), Next.js (web), PostgreSQL + Prisma, Redis (cache + BullMQ +
throttling), Docker Compose. TypeScript everywhere.

## Repo structure

```
apps/
  api/          NestJS. Feature modules.
  web/          Next.js. Calendar UI.
packages/
  shared/       Shared TS types + enums used by both apps.
docker-compose.yml
CLAUDE.md
DECISIONS.md    Why each non-obvious choice was made. Keep updated.
```

## API structure (standard NestJS feature modules, no hexagonal ceremony)

```
apps/api/src/
  modules/
    auth/                 JWT + roles, strategies, guards, decorators
    appointments/
      appointments.controller.ts
      appointments.service.ts      business rules / orchestration
      appointments.repository.ts   ALL Prisma queries live here
      dto/
      domain/
        appointment-status.machine.ts   pure state machine, no Nest/Prisma
        overlap.ts                       pure overlap logic, no Nest/Prisma
    doctors/
      availability.service.ts
  shared/
    guards/ interceptors/ filters/ decorators/ pipes/
    prisma/prisma.service.ts
```

## Hard rules (do not violate)

1. Business rules live in the service. Prisma queries live in the repository.
   The service never touches PrismaClient directly.
2. `domain/` files are pure functions. No Nest, no Prisma, no I/O. Input to output.
   Overlap logic and the status state machine go here so they're unit-testable.
3. `clinicId` ALWAYS comes from the JWT payload via the `@ClinicId()` decorator.
   NEVER from the request body or params. This is the tenancy backbone.
4. Every appointment query is scoped by `clinicId`. No exceptions.
5. Domain layer throws named domain exceptions (OverlappingAppointmentError,
   InvalidStatusTransitionError, DoctorUnavailableError, CrossTenantAccessError).
   A global exception filter maps them to HTTP codes (409/422/403). The domain
   layer never knows about HTTP status codes.
6. Validation via class-validator DTOs at the controller boundary. Global
   ValidationPipe with whitelist: true, forbidNonWhitelisted: true.
7. Time is stored as UTC timestamps (startsAt, endsAt), never date+time strings.
8. Double-booking correctness is guaranteed by a Postgres exclusion constraint
   (btree_gist, tstzrange, scoped by doctorId+clinicId,
   WHERE status NOT IN (CANCELLED, NO_SHOW)).
   This is the source of truth. App-level checks are for friendly errors only.
9. Redis is an optimization layer, never a correctness mechanism. Availability
   cache + BullMQ + throttler. If Redis is down, correctness still holds.

## Coding standards (always apply)

- No comments except where logic is genuinely non-obvious. No comments that
  restate what the code says. Self-documenting names over explanatory comments.
- Cross-cutting concerns use the right NestJS primitive: guards for access
  control, interceptors for response shaping/logging/timing, pipes for
  validation/transformation, filters for error mapping, param decorators for
  pulling context (@CurrentUser, @ClinicId). Don't reach into req manually.
- Controllers are thin: extract, delegate to service, return. No logic.
- No dead code, no commented-out code, no unused imports, no console.log.
- Meaningful names. No abbreviations that aren't domain-standard.
- Small functions, single responsibility. Early returns over nested ifs.
- Strict TypeScript: no `any` unless truly unavoidable and justified.
- Consistent error handling: throw domain exceptions, never raw HttpException
  from services. Let the filter map them.

## Status state machine

```
SCHEDULED  -> CONFIRMED | CANCELLED
CONFIRMED  -> COMPLETED | CANCELLED | NO_SHOW
COMPLETED  -> terminal
CANCELLED  -> terminal
NO_SHOW    -> terminal
```
Illegal transitions throw InvalidStatusTransitionError (422).

## Overlap rule

Two active appointments for the same doctor collide when:
`newStart < existingEnd AND newEnd > existingStart`
Intervals are half-open [start, end), so back-to-back (10:00-10:30, 10:30-11:00)
do NOT collide. When rescheduling, exclude the appointment's own id from the check.

## Roles

- ADMIN: anything within their clinic
- RECEPTIONIST: create, reschedule, list
- DOCTOR: change status on their own appointments, view
Enforced with RolesGuard + @Roles() decorator.

## Git / commit rules

- Conventional commits: feat:, fix:, chore:, test:, docs:, refactor:
- Small, logical commits. One concern per commit.
- DO NOT commit automatically. Only commit when I explicitly ask.
  I own the git history. Stage and propose messages, but wait for my go-ahead.
- Never commit .env, secrets, or node_modules.

## Testing conventions

- Pure domain functions (overlap, state machine): tested directly, no mocks.
- Services: tested with a mocked repository.
- Must-have tests: overlap rejected, concurrent double-booking (exactly one wins),
  illegal status transition, cross-tenant access blocked, reschedule-onto-self allowed.

## What we deliberately do NOT build (anti-over-engineering)

No microservices, no Kafka, no CQRS/event-sourcing, no GraphQL, no hexagonal
ports-and-adapters. This is a focused module. Right-sized beats impressive-looking.
If a pattern doesn't solve a real problem here, don't add it.

## When adding a new feature module

Follow this order: dto -> domain (if pure logic) -> repository -> service ->
controller -> wire into module -> tests. Keep each layer's responsibility clean.
