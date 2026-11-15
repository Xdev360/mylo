'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { iso } from '@/lib/dates';
import { useHydrated } from '@/lib/local';
import { MIN_AGE, ageOn, blockUnder13, isBlocked, useOnboarding } from '@/lib/signin';
import { Art, BackButton, Foot, Screen } from './ui';

/* S1 Age check (877:107895) and S2 Under 13 (877:107920). Under 13 stops
   sign-up for a day and drops the answers typed so far, as S2 says. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ROW = 40;

function Wheel({ items, index, onChange, label, className }: { items: string[]; index: number; onChange: (i: number) => void; label: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(index);
  const settle = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (Math.round(el.scrollTop / ROW) !== index) el.scrollTo({ top: index * ROW, behavior: el.scrollTop === 0 && index > 0 ? 'auto' : 'smooth' });
  }, [index]);

  const clamp = (i: number) => Math.max(0, Math.min(items.length - 1, i));
  return (
    <div ref={ref} className={`si-wheel ${className}`} tabIndex={0} role="spinbutton" aria-label={label}
         aria-valuenow={index} aria-valuetext={items[index]} aria-valuemin={0} aria-valuemax={items.length - 1}
         onScroll={e => {
           const p = e.currentTarget.scrollTop / ROW;
           setPos(p);
           window.clearTimeout(settle.current);
           settle.current = window.setTimeout(() => { const i = clamp(Math.round(p)); if (i !== index) onChange(i); }, 90);
         }}
         onKeyDown={e => {
           if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(index + 1)); }
           if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(index - 1)); }
         }}>
      {items.map((t, i) => {
        const d = Math.abs(i - pos);
        return (
          <button key={t} type="button" tabIndex={-1} className={`si-wheel-row${d < 0.5 ? ' is-on' : ''}`}
                  style={{ opacity: d < 0.5 ? 1 : d < 1.5 ? 0.6 : d < 2.5 ? 0.35 : 0.2 }}
                  onClick={() => onChange(i)}>{t}</button>
        );
      })}
    </div>
  );
}

export default function Age() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [, update] = useOnboarding();
  const [stopped, setStopped] = useState(false);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 101 }, (_, i) => String(thisYear - 100 + i));
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(() => years.indexOf('2000'));
  const [day, setDay] = useState(0);
  const y = Number(years[year]);
  const daysIn = new Date(y, month + 1, 0).getDate();
  const days = Array.from({ length: daysIn }, (_, i) => String(i + 1));
  const dayAt = Math.min(day, daysIn - 1);

  if (!hydrated) return <Screen className="si-blank" />;

  if (stopped || isBlocked()) return (
    <Screen className="si-under">
      <span className="si-under-hero"><Art name="mylo-plain" w={100} h={120} /></span>
      <h1 className="si-title-l si-center">Mylo is not for you yet</h1>
      <p className="si-under-body">You need to be 13 or older to use Mylo. We have not saved anything you typed.</p>
      <p className="si-under-note"><Icon name="signin/i-shield" size={24} />Made a mistake? You can try again in 24 hours.</p>
      <Foot>
        <button type="button" className="si-cta-s is-soft" onClick={() => router.push('/welcome')}>Close</button>
      </Foot>
    </Screen>
  );

  const go = () => {
    const birth = new Date(y, month, dayAt + 1);
    if (ageOn(birth) < MIN_AGE) { blockUnder13(); setStopped(true); return; }
    update({ birthday: iso(birth) });
    router.push('/onboarding/vibe');
  };

  return (
    <Screen>
      <header className="si-head"><BackButton fallback="/onboarding/who" /></header>
      <h1 className="si-title-l si-age-title">When is your birthday?</h1>
      <p className="si-age-sub">Mylo is for people 13 and up. We do not show this on your profile.</p>
      <div className="si-wheels">
        <span className="si-wheel-band" aria-hidden />
        <Wheel items={MONTHS} index={month} onChange={setMonth} label="Month" className="is-month" />
        <Wheel items={days} index={dayAt} onChange={setDay} label="Day" className="is-day" />
        <Wheel items={years} index={year} onChange={setYear} label="Year" className="is-year" />
      </div>
      <Foot>
        <button type="button" className="si-cta-s" onClick={go}>Continue</button>
      </Foot>
    </Screen>
  );
}
