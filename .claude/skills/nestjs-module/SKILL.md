---
name: nestjs-module
description: Recipe for adding a feature module to apps/api in this repo. Use whenever creating or extending a NestJS feature module (controller, service, repository, dto, domain logic). Enforces the layering and tenancy rules from CLAUDE.md.
---

# Adding a feature module

Build in this exact order. Each step compiles before the next.

## 1. DTOs (`modules/<feature>/dto/`)

- class-validator decorators on every field. Global pipe runs with
  `whitelist: true, forbidNonWhitelisted: true`, so undeclared fields are rejected.
- Dates come in as ISO strings (`@IsISO8601()`), converted to `Date` in the service.
- NEVER put `clinicId` in a DTO. Tenancy comes from the JWT only.

## 2. Domain (`modules/<feature>/domain/`) — only if there's pure logic

- Pure functions: input → output or throw. No Nest, no Prisma, no I/O, no Date.now()
  inside logic (pass time in).
- Throws named domain exceptions (e.g. `OverlappingAppointmentError`,
  `InvalidStatusTransitionError`). Domain never knows HTTP codes — the global
  exception filter in `shared/filters/` maps them (409/422/403).
- No pure logic to extract? Skip this folder entirely. Don't create empty ceremony.

## 3. Repository (`modules/<feature>/<feature>.repository.ts`)

- `@Injectable()`, injects `PrismaService`. ALL Prisma queries for the feature
  live here — the only file in the module that imports anything Prisma.
- Every query takes `clinicId` as an explicit parameter and includes it in the
  `where`. No exceptions, no default.
- Translate Prisma-specific errors here (e.g. exclusion-constraint violation →
  `OverlappingAppointmentError`) so the service stays Prisma-free.

## 4. Service (`modules/<feature>/<feature>.service.ts`)

- Business rules and orchestration only. Calls domain functions and the
  repository. Never touches `PrismaClient` or writes queries.
- Receives `clinicId` (and actor info) as method arguments from the controller.
- Not-found within the clinic scope → treat as not found (404), never leak
  other tenants' existence.

## 5. Controller (`modules/<feature>/<feature>.controller.ts`)

- Thin: extract, delegate, return. No business logic.
- `clinicId` via `@ClinicId()` decorator (reads JWT payload). NEVER from
  body/params/query.
- `@Roles(...)` per route: ADMIN anything in-clinic; RECEPTIONIST create,
  reschedule, list; DOCTOR status changes on own appointments + view.
- No try/catch for domain errors — the global filter handles them.

## 6. Module wiring

- `<feature>.module.ts` declares controller + providers (service, repository),
  imported in `AppModule`. Export the service only if another module needs it.

## 7. Tests

See the `testing` skill. Minimum: domain functions tested directly, service
tested with a mocked repository.

## Checklist before calling it done

- [ ] No `PrismaClient`/`PrismaService` import outside the repository
- [ ] No Nest/Prisma import inside `domain/`
- [ ] Every repository query filters by `clinicId`
- [ ] `clinicId` never appears in a DTO, body, or route param
- [ ] Domain errors are named classes, mapped to HTTP only in the global filter
- [ ] Timestamps are UTC `Date` objects (`startsAt`, `endsAt`), never date+time strings
