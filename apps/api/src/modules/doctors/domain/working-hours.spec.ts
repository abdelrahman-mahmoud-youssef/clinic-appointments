import { isWithinWorkingHours, WorkingHoursWindow } from './working-hours';

// 2027-01-04 is a Monday (UTC weekday 1).
const MONDAY_WINDOWS: WorkingHoursWindow[] = [{ weekday: 1, startTime: '09:00', endTime: '17:00' }];

const t = (iso: string) => new Date(iso);

describe('isWithinWorkingHours', () => {
  it('allows an appointment fully inside working hours', () => {
    expect(
      isWithinWorkingHours(MONDAY_WINDOWS, t('2027-01-04T10:00:00Z'), t('2027-01-04T10:30:00Z')),
    ).toBe(true);
  });

  it('rejects an appointment outside working hours', () => {
    expect(
      isWithinWorkingHours(MONDAY_WINDOWS, t('2027-01-04T18:00:00Z'), t('2027-01-04T18:30:00Z')),
    ).toBe(false);
  });

  it('rejects a weekday with no availability rows', () => {
    // 2027-01-05 is a Tuesday; MONDAY_WINDOWS only covers weekday 1.
    expect(
      isWithinWorkingHours(MONDAY_WINDOWS, t('2027-01-05T10:00:00Z'), t('2027-01-05T10:30:00Z')),
    ).toBe(false);
  });

  it('rejects an appointment that starts inside but ends after the window', () => {
    expect(
      isWithinWorkingHours(MONDAY_WINDOWS, t('2027-01-04T16:30:00Z'), t('2027-01-04T17:30:00Z')),
    ).toBe(false);
  });

  it('rejects an appointment that starts before the window', () => {
    expect(
      isWithinWorkingHours(MONDAY_WINDOWS, t('2027-01-04T08:30:00Z'), t('2027-01-04T09:30:00Z')),
    ).toBe(false);
  });

  it('allows an appointment matching the window exactly', () => {
    expect(
      isWithinWorkingHours(MONDAY_WINDOWS, t('2027-01-04T09:00:00Z'), t('2027-01-04T17:00:00Z')),
    ).toBe(true);
  });

  it('supports split shifts: fits the second window but not the gap between them', () => {
    const splitShift: WorkingHoursWindow[] = [
      { weekday: 1, startTime: '09:00', endTime: '12:00' },
      { weekday: 1, startTime: '13:00', endTime: '17:00' },
    ];

    expect(isWithinWorkingHours(splitShift, t('2027-01-04T13:30:00Z'), t('2027-01-04T14:00:00Z'))).toBe(
      true,
    );
    expect(isWithinWorkingHours(splitShift, t('2027-01-04T11:30:00Z'), t('2027-01-04T13:30:00Z'))).toBe(
      false,
    );
  });

  it('rejects an appointment spanning midnight into a different weekday', () => {
    expect(
      isWithinWorkingHours(MONDAY_WINDOWS, t('2027-01-04T23:30:00Z'), t('2027-01-05T00:30:00Z')),
    ).toBe(false);
  });
});
