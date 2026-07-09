---
name: senior-review
description: Self-review pass before staging changes or proposing a commit in this repo. Use after finishing any feature slice, before presenting it — catches layering violations, tenancy leaks, and junior tells.
---

# Senior self-review

Run this pass on the diff BEFORE staging and proposing a commit message.
Anything caught here is fixed silently, not shipped with an apology.

## Layering (grep the diff, don't trust memory)

- `PrismaService`/`@prisma/client` imported anywhere except a repository or
  `shared/prisma/`? Violation.
- Any import of `@nestjs/*` or Prisma inside `domain/`? Violation.
- `HttpException`/`throw new BadRequestException` etc. in a service or domain
  file? Violation — domain exceptions only, the filter maps them.
- Controller doing more than extract → delegate → return? Move it down.

## Tenancy (the one that fails the interview)

- Every new/changed repository query includes `clinicId` in its `where`.
- `clinicId` appears in no DTO, no route param, no query param.
- Cache keys and job payloads include `clinicId`.
- Cross-tenant lookups return not-found, never "forbidden for this resource"
  (which confirms existence).

## Junior tells (delete on sight)

- Comments restating the code; commented-out code; `console.log`; unused
  imports; `any` without a written justification.
- try/catch that only re-throws or converts to a generic 500.
- Defensive checks for states the type system already excludes.
- A new abstraction with one caller. Inline it.
- Copy-pasted logic that exists in `domain/` or a shared helper — reuse it.

## Correctness spot-checks

- New time logic: half-open `[start, end)` respected? UTC `Date`s, no strings?
- Status changes go through the state machine function — no ad-hoc
  `if (status === ...)` transition checks in services.
- Anything that changed appointment writes: does the concurrency guarantee
  still rest on the DB constraint (not on a check-then-insert)?
- New behavior has its test per the testing skill; touched behavior's
  existing tests still pass — actually run them.

## Before proposing the commit

- Diff is one concern. If the message needs "and", split it.
- Conventional commit type matches the change (feat/fix/chore/test/docs/refactor).
- DECISIONS.md updated if the change embodies a non-obvious choice.
- `pnpm build` passes from the repo root.
