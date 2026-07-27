import { formatEuropeanDate } from './dateFormatter';

describe('formatEuropeanDate', () => {
  it('formats YYYY-MM-DD date to European DD.MM.YYYY format (happy path)', () => {
    expect(formatEuropeanDate('2026-07-21')).toBe('21.07.2026');
    expect(formatEuropeanDate('2025-12-31')).toBe('31.12.2025');
  });

  it('handles empty or undefined input gracefully (edge case)', () => {
    expect(formatEuropeanDate(undefined)).toBe('select date');
    expect(formatEuropeanDate('')).toBe('select date');
  });

  it('returns original input if it does not contain dashes (edge case)', () => {
    expect(formatEuropeanDate('2026')).toBe('2026');
    expect(formatEuropeanDate('select date')).toBe('select date');
  });
});
