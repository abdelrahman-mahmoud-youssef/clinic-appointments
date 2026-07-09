import { overlaps } from './overlap';

const t = (iso: string) => new Date(iso);

describe('overlaps', () => {
  it('returns true when ranges overlap', () => {
    expect(
      overlaps(
        { startsAt: t('2027-01-01T10:00:00Z'), endsAt: t('2027-01-01T10:30:00Z') },
        { startsAt: t('2027-01-01T10:15:00Z'), endsAt: t('2027-01-01T10:45:00Z') },
      ),
    ).toBe(true);
  });

  it('returns false for back-to-back ranges (half-open interval)', () => {
    expect(
      overlaps(
        { startsAt: t('2027-01-01T10:00:00Z'), endsAt: t('2027-01-01T10:30:00Z') },
        { startsAt: t('2027-01-01T10:30:00Z'), endsAt: t('2027-01-01T11:00:00Z') },
      ),
    ).toBe(false);
  });

  it('returns true for identical ranges', () => {
    const range = { startsAt: t('2027-01-01T10:00:00Z'), endsAt: t('2027-01-01T10:30:00Z') };
    expect(overlaps(range, { ...range })).toBe(true);
  });

  it('returns true when one range fully contains the other', () => {
    expect(
      overlaps(
        { startsAt: t('2027-01-01T09:00:00Z'), endsAt: t('2027-01-01T11:00:00Z') },
        { startsAt: t('2027-01-01T09:30:00Z'), endsAt: t('2027-01-01T10:00:00Z') },
      ),
    ).toBe(true);
  });

  it('returns false for adjacent-but-disjoint ranges with a gap between them', () => {
    expect(
      overlaps(
        { startsAt: t('2027-01-01T09:00:00Z'), endsAt: t('2027-01-01T09:30:00Z') },
        { startsAt: t('2027-01-01T10:00:00Z'), endsAt: t('2027-01-01T10:30:00Z') },
      ),
    ).toBe(false);
  });
});
