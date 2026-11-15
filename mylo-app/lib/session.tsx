'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/* Who is signed in, from Supabase Auth, kept live with onAuthStateChange.
   The profile row is the same `profiles` table the current app reads
   (js/app.js loadProfile), so an existing account shows its own name.

   Mount <SessionProvider> once in AppShell. useSession() also works without
   it (it then listens on its own), so the sign-in screens run either way. */
export type Profile = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  banned_at?: string | null;
  disabled_at?: string | null;
  [key: string]: unknown;
};

export type SessionState = {
  /** True until the first answer from Supabase: render nothing that depends on it. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** The name to greet with: display name, then username, else null. */
  name: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

async function loadProfile(id: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase().from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) return null;
    return (data as Profile | null) ?? null;
  } catch { return null; }
}

function useSessionState(enabled: boolean): SessionState {
  const [loading, setLoading] = useState(enabled);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const uid = session?.user.id ?? null;

  useEffect(() => {
    if (!enabled) return;
    const sb = supabase();
    let live = true;
    sb.auth.getSession().then(({ data }) => {
      if (!live) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      // A recovery link signs the person in for one thing only: a new password.
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset') window.location.assign(new URL('/reset', window.location.origin).href);
    });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !uid) return;
    let live = true;
    loadProfile(uid).then(p => { if (live) setProfile(p); });
    return () => { live = false; };
  }, [enabled, uid]);

  const refreshProfile = useCallback(async () => {
    if (uid) setProfile(await loadProfile(uid));
  }, [uid]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  return useMemo<SessionState>(() => {
    const p = uid && profile?.id === uid ? profile : null;
    const meta = session?.user.user_metadata as { username?: string; display_name?: string } | undefined;
    const name = p?.display_name || p?.username || meta?.display_name || meta?.username || null;
    return { loading, session, user: session?.user ?? null, profile: p, name, signOut, refreshProfile };
  }, [loading, session, uid, profile, signOut, refreshProfile]);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const value = useSessionState(true);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(Ctx);
  const own = useSessionState(ctx === null);
  return ctx ?? own;
}
