import { dateTimeFormatter } from '@/lib/formatters';

describe('Intl formatter singletons', () => {
  it('returns same instance across imports', async () => {
    const { dateTimeFormatter: dt2 } = await import('@/lib/formatters');
    expect(dt2).toBe(dateTimeFormatter);
  });

  it('formats date consistently', () => {
    const sample = new Date('2025-04-22T18:30:00Z');
    const formatted = dateTimeFormatter.format(sample);
    expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{2},? \d{1,2}:\d{2}/);
  });
}); 