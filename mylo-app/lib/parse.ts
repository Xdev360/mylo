import { addDays, iso, todayIso } from './dates';

/* "Gym tomorrow at 7pm with Tobi for an hour" → the details D1 shows as
   chips. Mylo AI will do this on the server; until then this reads the plain
   cases on the device, and anything it cannot read stays in the title. */
export type Tone = 'blue' | 'green' | 'amber' | 'red';
export type Parsed = { title: string; date: string; time?: string; minutes?: number; with?: string; tag?: { label: string; tone: Tone } };

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TAGS: [RegExp, string, Tone][] = [
  [/\b(gym|run|walk|workout|yoga|pilates|swim|football|fitness|water)\b/i, 'Health', 'green'],
  [/\b(read|study|journal|learn|course|exam|book)\b/i, 'Mind', 'amber'],
  [/\b(work|meeting|invoice|email|deep work|client|project)\b/i, 'Work', 'blue'],
  [/\b(mum|mom|dad|family|call)\b/i, 'Family', 'red']
];

export function parse(input: string, now = new Date()): Parsed {
  let s = ` ${input.trim()} `;
  let date = todayIso();
  let time: string | undefined, minutes: number | undefined, withWho: string | undefined;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) { fn(m); s = s.replace(m[0], ' '); }
  };

  take(/\b(today|tonight)\b/i, () => { date = todayIso(); });
  take(/\btomorrow\b/i, () => { date = iso(addDays(now, 1)); });
  take(new RegExp(`\\b(on )?(${DAYS.join('|')})\\b`, 'i'), m => {
    const target = DAYS.indexOf(m[2].toLowerCase());
    const ahead = (target - now.getDay() + 7) % 7 || 7;
    date = iso(addDays(now, ahead));
  });
  take(/\b(at )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, m => {
    let h = Number(m[2]) % 12; if (m[4].toLowerCase() === 'pm') h += 12;
    time = `${String(h).padStart(2, '0')}:${m[3] ?? '00'}`;
  });
  if (!time) take(/\bat (\d{1,2}):(\d{2})\b/i, m => { time = `${m[1].padStart(2, '0')}:${m[2]}`; });
  take(/\bfor (an|one) hour\b/i, () => { minutes = 60; });
  take(/\bfor (\d+)\s*(h|hr|hrs|hours?)\b/i, m => { minutes = Number(m[1]) * 60; });
  take(/\bfor (\d+)\s*(m|min|mins|minutes?)\b/i, m => { minutes = Number(m[1]); });
  take(/\bwith ([A-Z][a-z]+)\b/, m => { withWho = m[1]; });

  const tag = TAGS.find(([re]) => re.test(input));
  const title = s.replace(/\s+/g, ' ').trim().replace(/^\w/, c => c.toUpperCase());
  return { title: title || input.trim(), date, time, minutes, with: withWho, tag: tag ? { label: tag[1], tone: tag[2] } : undefined };
}
