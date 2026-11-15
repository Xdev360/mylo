'use client';

import { useCallback } from 'react';
import { useLocal } from './local';
import { supabase } from './supabase';

/* ── Onboarding answers (O3 to O15) ─────────────────────────────────────────
   Kept on the device under one key until there is an account to carry them.
   Nothing here is filled in for the person: every answer starts empty. */
export type Vibe = 'gentle' | 'playful' | 'coach';
export type Onboarding = {
  want: string[];
  time: 'early' | 'day' | 'night' | null;
  who: 'me' | 'partner' | 'crew' | 'unsure' | null;
  birthday: string | null;
  vibe: Vibe;
  myloName: string;
  minutes: number | null;
  nudge: boolean;
  nudgeTime: string;
  goal: string;
  /** The goal O9 put on Today, so going back and changing it edits that one. */
  goalId: string | null;
  photo: string | null;
  nudges: 'on' | 'off' | null;
  done: boolean;
  /** The step the person was last on, so coming back picks up there. */
  at: Step | null;
};
export const ONBOARDING_KEY = 'mylo.onboarding.v1';
/* The character's own name until the person picks one (O6, O7). */
export const DEFAULT_MYLO_NAME = 'Momo';
export const EMPTY_ONBOARDING: Onboarding = {
  want: [], time: null, who: null, birthday: null, vibe: 'playful', myloName: DEFAULT_MYLO_NAME,
  minutes: null, nudge: true, nudgeTime: '07:30', goal: '', goalId: null, photo: null, nudges: null, done: false, at: null
};

/* The steps behind /onboarding/[step], in order, one flow from O3 to O15
   with the age check (S1/S2) between "who" and "vibe". The progress bar
   counts the eight drawn with dashes. */
export const STEPS = ['want', 'time', 'who', 'age', 'vibe', 'name', 'rhythm', 'goal', 'badge', 'save', 'photo', 'nudges', 'people', 'done'] as const;
export type Step = typeof STEPS[number];
export const PROGRESS_STEPS = 8;
export const isStep = (s: string): s is Step => (STEPS as readonly string[]).includes(s);
export const stepPath = (s: Step) => `/onboarding/${s}`;
export const stepIndex = (s: Step) => STEPS.indexOf(s);

/* What the top row shows on each step, as the frames draw it: the dashes
   (and which one is lit), Skip on the steps that can be passed over, and
   no row at all on O15. */
export type StepMeta = { progress?: number; skip?: boolean; noHeader?: boolean };
export const STEP_META: Record<Step, StepMeta> = {
  want: { progress: 1, skip: true }, time: { progress: 2, skip: true }, who: { progress: 3, skip: true },
  age: {}, vibe: { progress: 4 }, name: { progress: 5 }, rhythm: { progress: 6 }, goal: { progress: 7, skip: true },
  badge: { progress: 8 }, save: {}, photo: { skip: true }, nudges: {}, people: { skip: true }, done: { noHeader: true }
};

/* Where Continue (or Skip) leads. Skipping the goal also passes over the
   badge that celebrates it; a person who already has an account never sees
   "Save your Mylo". Null means the flow is over. */
export function nextStep(s: Step, { signedIn = false, skipped = false } = {}): Step | null {
  if (s === 'goal' && skipped) return signedIn ? 'photo' : 'save';
  if (s === 'badge') return signedIn ? 'photo' : 'save';
  if (s === 'done') return null;
  return STEPS[stepIndex(s) + 1];
}
/* Where Back leads when there is no record of the way in (a fresh tab). */
export function prevStep(s: Step, { signedIn = false } = {}): Step | null {
  if (s === 'want') return null;
  if (s === 'photo') return signedIn ? 'badge' : 'save';
  return STEPS[stepIndex(s) - 1];
}
/* Every step after the age check waits for a birthday. */
export const needsAge = (s: Step, ob: Onboarding) => stepIndex(s) > stepIndex('age') && !ob.birthday;

/* ── Age check (S1, S2) ───────────────────────────────────────────────────── */
export const AGE_KEY = 'mylo.signin.age.v1';
export const MIN_AGE = 13;
export function ageOn(birth: Date, now = new Date()) {
  let a = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--;
  return a;
}
export function blockedUntil(): number {
  try { const v = JSON.parse(localStorage.getItem(AGE_KEY) ?? 'null') as { until?: number } | null; return v?.until ?? 0; } catch { return 0; }
}
export const isBlocked = () => blockedUntil() > Date.now();
/* "We have not saved anything you typed": the answers go with the block. */
export function blockUnder13() {
  try {
    localStorage.setItem(AGE_KEY, JSON.stringify({ until: Date.now() + 24 * 60 * 60 * 1000 }));
    localStorage.removeItem(ONBOARDING_KEY);
  } catch { /* storage blocked */ }
}

/* ── Where to go after signing in ─────────────────────────────────────────── */
const NEXT_KEY = 'mylo.signin.next';
const EMAIL_KEY = 'mylo.signin.email';
export const INVITE_KEY = 'mylo.signin.invite.v1';
export function setNext(path: string) { try { sessionStorage.setItem(NEXT_KEY, path); } catch { /* blocked */ } }
export function takeNext(fallback = '/today') {
  try {
    const n = sessionStorage.getItem(NEXT_KEY); sessionStorage.removeItem(NEXT_KEY);
    if (n && n.startsWith('/') && !n.startsWith('//')) return n;
  } catch { /* blocked */ }
  return hasInvite() ? '/signin/in' : fallback;
}
export function setPendingEmail(email: string) { try { sessionStorage.setItem(EMAIL_KEY, email); } catch { /* blocked */ } }
export function pendingEmail() { try { return sessionStorage.getItem(EMAIL_KEY) ?? ''; } catch { return ''; } }

/* X4 reads the room someone was let into, written by the invite flow:
   { roomId, room, by, members?: string[] }. */
export type Invite = { roomId: string; room: string; by: string; members?: string[] };
export function readInvite(): Invite | null {
  try {
    const v = JSON.parse(localStorage.getItem(INVITE_KEY) ?? 'null') as Invite | null;
    return v && v.roomId && v.room ? v : null;
  } catch { return null; }
}
export const hasInvite = () => readInvite() !== null;
export function clearInvite() { try { localStorage.removeItem(INVITE_KEY); } catch { /* blocked */ } }

/* ── Auth, the same rules as js/app.js ────────────────────────────────────── */
export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

/* The box takes a username or an email; Supabase only takes the email. An
   unknown username still goes on to a real attempt, so the error never says
   which usernames exist. */
export async function resolveLoginEmail(raw: string) {
  const v = raw.trim();
  if (isEmail(v)) return v.toLowerCase();
  const uname = v.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '').slice(0, 20);
  const { data, error } = await supabase().rpc('email_for_username', { p_username: uname });
  if (error) throw error;
  return (data as string | null) || `${uname}@example.com`;
}

export function authMessage(e: unknown) {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e ?? '');
  if (/Invalid login/i.test(m)) return 'Wrong email or password';
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first, then sign in';
  if (/expired|invalid.*(otp|token)|token.*(expired|invalid)/i.test(m)) return 'That code did not work. Check it or send a new one';
  if (/rate limit|too many|security purposes/i.test(m)) return 'Too many tries. Wait a minute and try again';
  if (/provider is not enabled|not enabled/i.test(m)) return 'That sign-in is not switched on yet. Use email instead';
  if (/Auth session missing/i.test(m)) return 'Open the reset link from your email again';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No connection. Try again';
  return m || 'Something went wrong. Try again';
}

export async function signInWithProvider(provider: 'google' | 'apple', next: string) {
  const { error } = await supabase().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}${next}`,
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined
    }
  });
  if (error) throw error;
}

/* Turns a picked photo into a small square JPEG, for the avatar. */
export function squareJpeg(file: File, size = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas'); c.width = size; c.height = size;
      const g = c.getContext('2d');
      if (!g) { URL.revokeObjectURL(url); reject(new Error('No canvas')); return; }
      g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('Could not read that photo'))), 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo')); };
    img.src = url;
  });
}
export const blobToDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(b);
});
export async function dataUrlToBlob(u: string) { return (await fetch(u)).blob(); }

/* Saves the avatar the same way the current app does: the `avatars` bucket,
   then profiles.avatar_url. */
export async function uploadAvatar(userId: string, blob: Blob) {
  const sb = supabase();
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (upErr) throw upErr;
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  const { error } = await sb.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId);
  if (error) throw error;
  return data.publicUrl;
}

/* The answers as one piece of saved state. Read it only after useHydrated(). */
export function useOnboarding() {
  const [raw, setRaw] = useLocal<Partial<Onboarding>>(ONBOARDING_KEY, EMPTY_ONBOARDING);
  const ob: Onboarding = { ...EMPTY_ONBOARDING, ...raw };
  const update = useCallback((patch: Partial<Onboarding>) => setRaw(prev => ({ ...EMPTY_ONBOARDING, ...prev, ...patch })), [setRaw]);
  return [ob, update] as const;
}
