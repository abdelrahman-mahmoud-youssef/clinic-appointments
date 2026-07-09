-- Prisma cannot express EXCLUDE constraints, so this migration is hand-written.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Source of truth for double-booking correctness (see CLAUDE.md rule 8).
-- tstzrange() defaults to the half-open bound '[)', so back-to-back
-- appointments (10:00-10:30, 10:30-11:00) do not collide.
-- CANCELLED/NO_SHOW are terminal and non-blocking, so they're excluded from
-- the guarded set and free their slot for rebooking.
ALTER TABLE "Appointment" ADD CONSTRAINT no_double_booking
EXCLUDE USING gist (
  "clinicId" WITH =,
  "doctorId" WITH =,
  tstzrange("startsAt", "endsAt") WITH &&
)
WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
