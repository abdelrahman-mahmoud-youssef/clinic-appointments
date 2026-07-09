---
name: testing
description: How this repo tests. Use whenever writing or modifying tests for the API — domain unit tests, service tests with mocked repositories, and the concurrency/double-booking integration test pattern.
---

# Testing in this repo

Three tiers. Use the cheapest tier that proves the behavior.

## 1. Domain functions — direct, no mocks

`domain/` files are pure, so test them as plain functions. No Nest testing
module, no DI, no mocks.

```ts
// overlap.spec.ts
expect(overlaps(s1, e1, s2, e2)).toBe(true);
// half-open intervals: back-to-back does NOT collide
expect(overlaps(t10_00, t10_30, t10_30, t11_00)).toBe(false);
```

State machine: assert every legal transition passes and at least one illegal
transition per state throws `InvalidStatusTransitionError`.

## 2. Services — mocked repository

Mock the repository object (plain `jest.fn()` per method — no auto-mocking
libraries). Assert business behavior, not query shapes.

```ts
const repo = { findOverlapping: jest.fn(), create: jest.fn(), ... };
const service = new AppointmentsService(repo as any, ...);
```

Test that the service:
- throws `OverlappingAppointmentError` when the repo reports a conflict
- passes `clinicId` through to every repo call
- excludes the appointment's own id on reschedule (reschedule-onto-self allowed)
- rejects illegal status transitions before hitting the repo

## 3. Integration — real Postgres, the concurrency test

The one test that justifies the whole design: concurrent double-booking,
exactly one wins. Runs against the docker-compose Postgres (not mocked, not
SQLite — the exclusion constraint IS the subject under test).

Pattern:

```ts
// same doctor, same clinic, same slot, fired truly concurrently
const results = await Promise.allSettled([
  bookAppointment(slot), // request A
  bookAppointment(slot), // request B
]);
const ok = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');
expect(ok).toHaveLength(1);
expect(failed).toHaveLength(1);
// loser fails with OverlappingAppointmentError (HTTP 409), not a raw DB error
```

Do NOT pre-check availability in this test — the point is that the DB
constraint wins the race, not the app-level check.

## Must-have tests (from CLAUDE.md — all five, no skipping)

- [ ] overlap rejected (domain + service)
- [ ] concurrent double-booking: exactly one wins (integration)
- [ ] illegal status transition throws (domain)
- [ ] cross-tenant access blocked — clinic A cannot read/modify clinic B's
      appointment; returns 404/403, never leaks existence
- [ ] reschedule-onto-self allowed (own id excluded from overlap check)

## Conventions

- Jest. Spec files live next to the code: `overlap.spec.ts` beside `overlap.ts`.
- Integration specs: `*.integration.spec.ts`, separate jest config/script so
  unit tests stay fast and dependency-free.
- No test needs Redis. If a test breaks when Redis is down, the code under
  test is violating hard rule 9.
