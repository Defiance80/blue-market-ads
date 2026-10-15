import type { RangeKey } from './ads/types';

// Dates as YYYY-MM-DD strings in the ACCOUNT's timezone, because that is
// how Google Ads defines "a day" for reporting.

export function todayIn(tz = 'America/Los_Angeles'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const parse = (d: string) => new Date(d + 'T12:00:00Z');
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => { const x = parse(d); x.setUTCDate(x.getUTCDate() + n); return fmt(x); };
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5) + 1;

export function rangeDates(key: RangeKey, tz?: string) {
  const today = todayIn(tz);
  const yesterday = addDays(today, -1);
  const [y, m] = today.split('-').map(Number);
  let start: string, end: string;
  switch (key) {
    case 'LAST_7_DAYS': start = addDays(yesterday, -6); end = yesterday; break;
    case 'LAST_14_DAYS': start = addDays(yesterday, -13); end = yesterday; break;
    case 'THIS_MONTH': start = `${y}-${String(m).padStart(2, '0')}-01`; end = today; break;
    case 'LAST_MONTH': {
      const first = new Date(Date.UTC(y, m - 2, 1));
      start = fmt(first);
      end = fmt(new Date(Date.UTC(y, m - 1, 0)));
      break;
    }
    case 'LAST_90_DAYS': start = addDays(yesterday, -89); end = yesterday; break;
    default: start = addDays(yesterday, -29); end = yesterday;
  }
  const len = daysBetween(start, end);
  return { start, end, prevStart: addDays(start, -len), prevEnd: addDays(start, -1) };
}
