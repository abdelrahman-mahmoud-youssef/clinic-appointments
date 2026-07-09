---
name: redis-patterns
description: How Redis is used in this repo — availability cache, BullMQ jobs, throttler — and the degradation rules that keep it an optimization, never a correctness mechanism. Use when adding caching, queue jobs, or rate limiting.
---

# Redis patterns

Hard rule 9: if Redis is down, the API stays correct — maybe slower, never
wrong. Every Redis touchpoint must satisfy the question: "what happens when
this Redis call throws?" If the answer isn't "we fall through to Postgres or
skip the optimization," the design is wrong.

## Availability cache

- Cache key: `availability:{clinicId}:{doctorId}:{dateISO}` — clinicId in the
  key ALWAYS (tenancy applies to cache keys too, a shared key is a data leak).
- Read path: try cache → miss or Redis error → compute from Postgres → best-
  effort `SET` with TTL. Wrap Redis calls so errors log and fall through;
  never let a cache failure fail the request.
- Invalidation: on any appointment write (create/reschedule/status change),
  delete the affected doctor+day keys. Deleting is best-effort; TTL is the
  backstop. Never write availability INTO the cache on the write path
  (read-through only — no cache-as-source-of-truth drift).
- Short TTL (60–300s). The cache serves the calendar UI, not the booking
  decision — booking correctness is the DB constraint's job.

## BullMQ

- Jobs are for side effects that can be late or retried (reminders,
  notifications). NEVER put booking/validation logic in a job.
- Job payload: ids only (`appointmentId`, `clinicId`), never full entities —
  the processor re-reads current state, so stale payloads can't act on
  outdated data.
- Processors are idempotent: re-check state before acting (appointment
  cancelled since the job was queued → do nothing, succeed).
- Enqueue is best-effort on the request path: if Redis is down, log and
  continue — the booking must still succeed.

## Throttler

- `@nestjs/throttler` with Redis storage on write endpoints (create,
  reschedule). Reads stay unthrottled or generous.
- Throttler storage failure must fail OPEN (requests pass), not closed —
  availability of booking beats rate-limit strictness here.
