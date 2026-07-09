# DECISIONS

Why each non-obvious choice was made. Newest at the bottom.

## Scaffold

- **Hand-rolled the NestJS app instead of `nest new`.** The generator assumes it
  owns the repo (own git init, own lockfile, own tsconfig chain) and fights pnpm
  monorepos; most of its output would be deleted anyway.
- **`@clinic/shared` builds to `dist/` and is consumed as a normal package
  (`workspace:*`)** rather than tsconfig path aliases. Plain `tsc`/`nest build`
  resolves it with zero runtime path-mapping machinery.

## Exclusion constraint scope

- The constraint's partial `WHERE` excludes **both CANCELLED and NO_SHOW** — the
  terminal, non-blocking states. A cancelled or no-show slot is bookable again;
  SCHEDULED/CONFIRMED/COMPLETED rows keep blocking their time range.
