'use client';

import Link from 'next/link';
import { notFound, usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { canGoBack, goBack, stampNav } from '@/components/NavMotion';
import { useHydrated } from '@/lib/local';
import { useSession } from '@/lib/session';
import {
  PROGRESS_STEPS, STEP_META, isBlocked, isStep, needsAge, nextStep, prevStep, stepIndex, stepPath, useOnboarding,
  type Onboarding, type Step, type StepMeta
} from '@/lib/signin';
import Age from './Age';
import { Time, Want, Who } from './steps/Pick';
import { Name, VibePick } from './steps/Vibe';
import { Rhythm } from './steps/Rhythm';
import { Badge, Goal } from './steps/Goal';
import { Done, Nudges, People, Photo, Save } from './steps/Finish';

/* ── O3 to O15 as one flow ──────────────────────────────────────────────────
   app/onboarding/layout.tsx keeps this mounted while the address moves from
   /onboarding/want to /onboarding/done, so the top row (back, the dashes,
   Skip) and the button at the bottom never leave the screen: only the step
   in between slides, forward to the left and back to the right. The address
   still changes with every step, so a reload lands on the same step with its
   answers, and the phone's own back gesture walks back through the steps.

   A step draws its middle and tells the flow what the bottom row says:

     useFoot({ label: 'Continue', disabled: !picked, onClick: next })      */

export type StepProps = {
  ob: Onboarding;
  update: (patch: Partial<Onboarding>) => void;
  /** On to the step after this one. */
  next: (opts?: { skipped?: boolean }) => void;
  /** Out of the flow, to another screen. */
  leave: (path: string, dir?: 'push' | 'tab') => void;
};

export type FootCfg = {
  label?: string;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  /** The small grey line under the button. */
  note?: string;
  noteHidden?: boolean;
  onNote?: () => void;
  noteHref?: string;
  /** S1/S2 draw a 52 high button with 16/500 type; S2's is the soft grey one. */
  size?: 's';
  tone?: 'soft';
  /** O11 has no button: its sign-in choices sit in the step itself. */
  hidden?: boolean;
};

const StepCtx = createContext<{ active: boolean; setFoot: (f: FootCfg) => void }>({ active: false, setFoot: () => {} });

/* Called by the step on screen on every render; the step sliding away is
   ignored, so the button always belongs to the step arriving. */
export function useFoot(cfg: FootCfg) {
  const { active, setFoot } = useContext(StepCtx);
  useLayoutEffect(() => { if (active) setFoot(cfg); });
}

const VIEWS: Record<Step, (p: StepProps) => React.ReactNode> = {
  want: Want, time: Time, who: Who, age: Age, vibe: VibePick, name: Name, rhythm: Rhythm,
  goal: Goal, badge: Badge, save: Save, photo: Photo, nudges: Nudges, people: People, done: Done
};
/* Steps whose screen draws its own backdrop or spacing. */
const STEP_CLASS: Partial<Record<Step, string>> = { badge: 'si-badge-screen', save: 'si-save', done: 'si-done' };

/* The way the person came through the steps in this tab, so Back retraces
   it (after skipping the goal, Back from "Save" returns to the goal, not to
   the badge they never saw). */
const TRAIL_KEY = 'mylo.onboarding.trail';
const readTrail = (): Step[] => {
  try { const t = JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? '[]') as string[]; return t.filter(isStep); } catch { return []; }
};
const writeTrail = (t: Step[]) => { try { sessionStorage.setItem(TRAIL_KEY, JSON.stringify(t.slice(-20))); } catch { /* blocked */ } };
function walk(trail: Step[], s: Step): Step[] {
  if (trail[trail.length - 1] === s) return trail;
  const at = trail.lastIndexOf(s);
  return at >= 0 ? trail.slice(0, at + 1) : [...trail, s];
}

/* Moving between steps is not a page change: tell the page transition in
   globals.css to stand aside (styles/signin.css handles data-nav="step"). */
const stampStep = () => { document.documentElement.dataset.nav = 'step'; };

const SLIDE_MS = 420;
const footKey = (f: FootCfg) => JSON.stringify([f.label, f.disabled, f.busy, f.note, f.noteHidden, !!f.onNote, f.noteHref, f.size, f.tone, f.hidden]);

export default function OnboardingFlow() {
  const router = useRouter();
  const path = usePathname();
  const hydrated = useHydrated();
  const { session, loading } = useSession();
  const signedIn = !!session;
  const [ob, update] = useOnboarding();
  const seg = path.split('/')[2] ?? '';
  const step: Step | null = isStep(seg) ? seg : null;
  if (path !== '/onboarding' && !step) notFound();

  /* What is on screen: the step arriving and, for a moment, the one leaving. */
  const [view, setView] = useState<{ cur: Step | null; prev: Step | null; dir: 1 | -1; n: number }>({ cur: step, prev: null, dir: 1, n: 0 });
  const viewRef = useRef(view);
  useLayoutEffect(() => { viewRef.current = view; }, [view]);
  // A redirect (to the age check, past "Save") swaps the step without a slide.
  const jump = useRef(false);
  const show = useCallback((to: Step) => {
    const v = viewRef.current;
    if (v.cur === to) return;
    const dir = v.cur && stepIndex(to) < stepIndex(v.cur) ? -1 : 1;
    const nv = { cur: to, prev: jump.current ? null : v.cur, dir, n: v.n + 1 } as const;
    viewRef.current = nv;
    setView(nv);
    jump.current = false;
  }, []);

  /* The bottom row, as the step on screen describes it. */
  const [foot, setFootState] = useState<FootCfg>({ hidden: true });
  const footFns = useRef<FootCfg>({});
  const setFoot = useCallback((f: FootCfg) => {
    footFns.current = f;
    setFootState(prev => (footKey(prev) === footKey(f) ? prev : f));
  }, []);

  /* Follow the address: a reload, the phone's back gesture, a link. Once a
     step has landed, page changes go back to their own transition. */
  useEffect(() => {
    if (!step) return;
    show(step);
    const t = window.setTimeout(() => { if (document.documentElement.dataset.nav === 'step') delete document.documentElement.dataset.nav; }, 800);
    return () => window.clearTimeout(t);
  }, [step, show]);
  useEffect(() => {
    if (!view.prev) return;
    const t = window.setTimeout(() => setView(v => (v.n === view.n ? { ...v, prev: null } : v)), SLIDE_MS + 40);
    return () => window.clearTimeout(t);
  }, [view.n, view.prev]);

  /* Remember the way in, and where to pick up next time. */
  useEffect(() => {
    if (!hydrated || !step) return;
    writeTrail(walk(readTrail(), step));
    if (ob.at !== step && step !== 'done') update({ at: step });
  }, [hydrated, step, ob.at, update]);

  /* The phone's back gesture inside the flow is a step, not a page. */
  useEffect(() => {
    const onPop = () => { if (/^\/onboarding\/[a-z]+$/.test(location.pathname)) stampStep(); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /* Steps after the age check wait for a birthday; under 13 waits a day;
     an account already made skips "Save your Mylo". */
  const cur = view.cur ?? step;
  const blocked = hydrated && isBlocked();
  const mustAge = hydrated && !!cur && cur !== 'age' && (blocked || needsAge(cur, ob));
  const skipSave = hydrated && !loading && signedIn && cur === 'save';
  useEffect(() => {
    if (mustAge) { jump.current = true; stampStep(); router.replace(stepPath('age')); }
    else if (skipSave) { jump.current = true; stampStep(); router.replace(stepPath('photo')); }
  }, [mustAge, skipSave, router]);

  // Warm the next screen so Continue never waits on the network.
  useEffect(() => {
    if (!cur) return;
    const n = nextStep(cur, { signedIn });
    if (n) router.prefetch(stepPath(n));
  }, [cur, signedIn, router]);

  /* One step per tap: a double tap on Continue must not skip a step. */
  const lockedUntil = useRef(0);
  const lock = () => {
    const now = performance.now();
    if (now < lockedUntil.current) return false;
    lockedUntil.current = now + SLIDE_MS * 0.6;
    return true;
  };

  const to = useCallback((s: Step) => {
    stampStep();
    show(s);
    router.push(stepPath(s));
    window.scrollTo({ top: 0 });
  }, [router, show]);

  const next = useCallback((opts?: { skipped?: boolean }) => {
    const c = viewRef.current.cur;
    if (!c || !lock()) return;
    const n = nextStep(c, { signedIn, skipped: opts?.skipped });
    if (n) to(n);
  }, [signedIn, to]);

  const leave = useCallback((target: string, dir: 'push' | 'tab' = 'push') => {
    stampNav(dir);
    router.push(target);
  }, [router]);

  const back = useCallback(() => {
    const c = viewRef.current.cur;
    if (!c || !lock()) return;
    const trail = readTrail();
    let target: Step | null = trail.length > 1 ? trail[trail.length - 2] : prevStep(c, { signedIn });
    if (target === 'save' && signedIn) target = 'badge';
    if (target === 'badge' && !ob.goalId && !ob.goal) target = 'goal';
    if (!target) {
      // Out of the flow, the way the person came in.
      if (canGoBack()) goBack(router); else { stampNav('pop'); router.push('/welcome'); }
      return;
    }
    stampStep();
    show(target);
    window.scrollTo({ top: 0 });
    if (trail.length > 1 && trail[trail.length - 2] === target) router.back();
    else router.push(stepPath(target));
  }, [router, show, signedIn, ob.goalId, ob.goal]);

  /* After a step lands, keyboard and screen reader users start at its title. */
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!view.n) return;
    const h = stageRef.current?.querySelector<HTMLElement>('.si-step.is-cur h1');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }, [view.n]);

  if (path === '/onboarding' || !cur) return null;
  if (!hydrated || mustAge || skipSave) return <main className="si-root si si-blank" />;

  // S2 (under 13) is a stop, drawn without the top row.
  const meta: StepMeta = cur === 'age' && blocked ? { noHeader: true } : STEP_META[cur];
  const views = [view.prev, cur].filter((s, i, a): s is Step => !!s && a.indexOf(s) === i);

  return (
    <main className={`si-root si si-flow is-${cur}`} data-dir={view.dir > 0 ? 'fwd' : 'back'}>
      <header className={`si-head si-flow-head${meta.noHeader ? ' is-gone' : ''}`} aria-hidden={meta.noHeader || undefined}>
        <button type="button" className="si-back" aria-label="Back" onClick={back} tabIndex={meta.noHeader ? -1 : undefined}>
          <Icon name="chevron-right" size={20} className="flip" />
        </button>
        <Progress at={meta.progress} />
        <button type="button" className={`si-skip${meta.skip ? '' : ' is-off'}`} onClick={() => next({ skipped: true })}
                tabIndex={meta.skip ? undefined : -1} aria-hidden={!meta.skip || undefined}>Skip</button>
      </header>

      <div className="si-stage" ref={stageRef}>
        {views.map(s => {
          const active = s === cur;
          const View = VIEWS[s];
          const motion = view.prev ? (active ? 'is-in' : 'is-out') : '';
          return (
            <section key={s} className={`si-step ${active ? 'is-cur' : ''} ${motion} ${STEP_CLASS[s] ?? ''}`} inert={!active || undefined} aria-hidden={!active || undefined}>
              <StepCtx.Provider value={{ active, setFoot }}>
                <View ob={ob} update={update} next={next} leave={leave} />
              </StepCtx.Provider>
            </section>
          );
        })}
      </div>

      <footer className={`si-foot si-flow-foot${foot.note && !foot.noteHidden ? '' : ' no-note'}${foot.hidden ? ' is-gone' : ''}${foot.size === 's' ? ' is-s' : ''}`}
              aria-hidden={foot.hidden || undefined}>
        <button type="button" className={`btn-primary si-cta${foot.tone === 'soft' ? ' is-soft' : ''}`}
                disabled={foot.disabled || foot.busy || foot.hidden} aria-busy={foot.busy || undefined}
                onClick={() => footFns.current.onClick?.()}>
          <span key={foot.label} className="si-cta-label">{foot.label}</span>
        </button>
        <span className="si-foot-note">
          {foot.note && (foot.noteHref
            ? <Link key={foot.note} className="si-note" href={foot.noteHref}>{foot.note}</Link>
            : foot.onNote
              ? <button key={foot.note} type="button" className="si-note" onClick={() => footFns.current.onNote?.()}>{foot.note}</button>
              : <span key={foot.note} className="si-note">{foot.note}</span>)}
        </span>
      </footer>
    </main>
  );
}

/* Eight dashes: the done ones short and black, the current one long. It
   stays mounted, so moving a step stretches one dash and shrinks the other;
   on steps the frames draw without it, it fades and keeps its place. */
function Progress({ at }: { at?: number }) {
  const [last, setLast] = useState(at ?? 1);
  if (at && at !== last) setLast(at);
  const n = at ?? last;
  return (
    <div className={`si-progress${at ? '' : ' is-off'}`} role="progressbar" aria-hidden={!at || undefined}
         aria-valuemin={1} aria-valuemax={PROGRESS_STEPS} aria-valuenow={n} aria-label={`Step ${n} of ${PROGRESS_STEPS}`}>
      {Array.from({ length: PROGRESS_STEPS }, (_, i) => (
        <span key={i} className={i + 1 < n ? 'is-done' : i + 1 === n ? 'is-now' : ''} />
      ))}
    </div>
  );
}
