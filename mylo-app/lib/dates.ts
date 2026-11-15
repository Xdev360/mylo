/* Days are local calendar dates, written YYYY-MM-DD, so "today" is the
   person's today wherever they are. */
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayIso = () => iso(new Date());
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

/* The week the design shows: Monday to Sunday around today. */
export function thisWeek(now = new Date()) {
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const longDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const dayLetter = (d: Date) => 'MTWTFSS'[(d.getDay() + 6) % 7];
export const weekdayName = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long' });

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/* 19:00 → 7:00 PM, the way C2 lists times. */
export function clock(hhmm: string, withPeriod = true) {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1;
  return withPeriod ? `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` : `${h12}:${String(m).padStart(2, '0')}`;
}
