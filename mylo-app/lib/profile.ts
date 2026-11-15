'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocal } from './local';
import { useSession } from './session';
import { supabase } from './supabase';

/* The signed-in person's profile, or this device's when nobody is signed in.
   Name, username and photo live in the same `profiles` table the current app
   uses (js/app.js reads and writes it the same way); everything the table has
   no column for yet (bio, cover, what friends see, badge colour) stays on the
   device under mylo.profile.v1. Every account starts empty. */

export type Visibility = 'friends' | 'everyone' | 'me';
export type BadgeColour = 'blue' | 'purple' | 'pink' | 'gold' | 'mint' | 'coral' | 'ink';

export type Profile = {
  name: string;
  username: string;
  bio: string;
  photo: string | null;
  /* Use my Mylo look (P25): Mylo stands in for a photo. */
  myloLook: boolean;
  showStreak: boolean;
  visibility: Visibility;
  badge: BadgeColour;
  verified: boolean;
  premium: boolean;
  /* What friends see, in order: card, pet and badge ids. Empty until the
     chest, the nest and the badges give the person something to pick. */
  showcase: string[];
  pets: string[];
  badges: string[];
};

export const EMPTY_PROFILE: Profile = {
  name: '', username: '', bio: '', photo: null, myloLook: false, showStreak: true, visibility: 'friends',
  badge: 'blue', verified: false, premium: false, showcase: [], pets: [], badges: []
};

export const VISIBILITY: Record<Visibility, string> = {
  friends: 'Friends and room members',
  everyone: 'Everyone on Mylo',
  me: 'Only me'
};

export const BADGE_COLOURS: { id: BadgeColour; label: string; hex: string }[] = [
  { id: 'blue', label: 'Blue', hex: '#3E7BFA' },
  { id: 'purple', label: 'Purple', hex: '#8B5CF6' },
  { id: 'pink', label: 'Pink', hex: '#F0569B' },
  { id: 'gold', label: 'Gold', hex: '#E9A92A' },
  { id: 'mint', label: 'Mint', hex: '#22B38A' },
  { id: 'coral', label: 'Coral', hex: '#F05A47' },
  { id: 'ink', label: 'Ink', hex: '#2B2B33' }
];
export const badgeHex = (c: BadgeColour) => BADGE_COLOURS.find(b => b.id === c)?.hex ?? '#3E7BFA';

export const USERNAME = /^[a-z0-9_]{3,20}$/;
export const cleanUsername = (s: string) => s.trim().toLowerCase().replace(/^@/, '');
export const USERNAME_RULE = 'Username: 3 to 20 letters, numbers or _';
/* What is wrong with a username, said plainly, or '' when it is fine. */
export function usernameProblem(raw: string) {
  const u = cleanUsername(raw);
  if (!u) return '';
  if (/[^a-z0-9_]/.test(u)) return USERNAME_RULE;
  if (u.length < 3) return USERNAME_RULE;
  if (u.length > 20) return USERNAME_RULE;
  return '';
}
/* Whether someone else already goes by `u`. Unknown (null) when the server
   cannot be asked; the save then gives the final answer. */
export async function usernameTaken(u: string, myId: string | null): Promise<boolean | null> {
  try {
    const { data, error } = await supabase().from('profiles').select('id').eq('username', cleanUsername(u)).limit(1);
    if (error) return null;
    return Boolean(data?.length && (data[0] as { id: string }).id !== myId);
  } catch { return null; }
}

type Row = { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null;
  is_verified?: boolean | null; verified?: boolean | null; is_premium?: boolean | null; premium?: boolean | null };

export const fromRow = (r: Row): Partial<Profile> => ({
  name: r.display_name ?? '',
  username: r.username ?? '',
  photo: r.avatar_url ?? null,
  verified: Boolean(r.is_verified ?? r.verified),
  premium: Boolean(r.is_premium ?? r.premium)
});

export function useProfile() {
  const [local, setLocal] = useLocal<Profile>('mylo.profile.v1', EMPTY_PROFILE);
  const [userId, setUserId] = useState<string | null>(null);
  const [remote, setRemote] = useState<Partial<Profile> | null>(null);
  const [checked, setChecked] = useState(false);
  const { refreshProfile } = useSession();

  useEffect(() => {
    let live = true;
    const sb = supabase();
    async function load(id: string | null) {
      if (!id) { if (live) { setUserId(null); setRemote(null); setChecked(true); } return; }
      try {
        const { data } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
        if (live) { setUserId(id); setRemote(data ? fromRow(data as Row) : {}); }
      } catch { if (live) { setUserId(id); setRemote({}); } }
      if (live) setChecked(true);
    }
    sb.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null)).catch(() => { if (live) setChecked(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { load(session?.user.id ?? null); });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);

  const profile: Profile = { ...EMPTY_PROFILE, ...local, ...(remote ?? {}) };

  /* Save a change. Device fields go straight to the device; name, username
     and photo go to the profiles row when signed in. Throws a readable
     message when the server refuses (a taken or badly shaped username). */
  const save = useCallback(async (patch: Partial<Profile>) => {
    if (userId) {
      const sb = supabase();
      const row: Record<string, string | null> = {};
      if (patch.name !== undefined) row.display_name = patch.name.trim().slice(0, 40) || null;
      if (patch.username !== undefined) {
        const u = cleanUsername(patch.username);
        if (u && !USERNAME.test(u)) throw new Error(USERNAME_RULE);
        if (u) row.username = u;
      }
      if (patch.photo !== undefined) row.avatar_url = patch.photo;
      if (Object.keys(row).length) {
        const { error } = await sb.from('profiles').update(row).eq('id', userId);
        if (error) throw new Error(error.code === '23505' ? 'That username is taken' : error.message);
        setRemote(r => ({
          ...(r ?? {}),
          ...('display_name' in row ? { name: row.display_name ?? '' } : {}),
          ...('username' in row ? { username: row.username ?? '' } : {}),
          ...('avatar_url' in row ? { photo: row.avatar_url } : {})
        }));
        // The sidebar and every other screen reading the session see it too.
        refreshProfile().catch(() => {});
      }
    } else if (patch.username !== undefined) {
      const u = cleanUsername(patch.username);
      if (u && !USERNAME.test(u)) throw new Error(USERNAME_RULE);
      patch = { ...patch, username: u };
    }
    const { name, username, photo, verified, premium, ...device } = patch;
    void verified; void premium;
    setLocal(prev => ({ ...prev, ...device, ...(userId ? {} : { ...(name !== undefined ? { name: name.trim().slice(0, 40) } : {}), ...(username !== undefined ? { username } : {}), ...(photo !== undefined ? { photo } : {}) }) }));
  }, [userId, setLocal, refreshProfile]);

  /* A cropped photo: uploaded to the avatars bucket when signed in, kept on
     the device as a small JPEG otherwise. */
  const savePhoto = useCallback(async (blob: Blob | null) => {
    if (!blob) return save({ photo: null });
    if (userId) {
      const sb = supabase();
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error } = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw new Error(error.message);
      const { data } = sb.storage.from('avatars').getPublicUrl(path);
      return save({ photo: data.publicUrl });
    }
    const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
    return save({ photo: url });
  }, [userId, save]);

  return { profile, signedIn: Boolean(userId), userId, checked, save, savePhoto };
}

/* A friend, read by username. Only what the profiles row holds; the rest of
   their profile arrives with the social tables. */
export function useFriend(username: string) {
  const [state, setState] = useState<{ status: 'loading' | 'found' | 'missing'; profile?: Profile & { id: string } }>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    supabase().from('profiles').select('*').eq('username', cleanUsername(username)).maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        if (!data) setState({ status: 'missing' });
        else setState({ status: 'found', profile: { ...EMPTY_PROFILE, ...fromRow(data as Row), id: (data as Row).id } });
      }, () => { if (live) setState({ status: 'missing' }); });
    return () => { live = false; };
  }, [username]);
  return state;
}

export const profileUrl = (username: string) =>
  `${typeof window === 'undefined' ? 'https://mylo.vercel.app' : window.location.origin}/u/${username}`;
