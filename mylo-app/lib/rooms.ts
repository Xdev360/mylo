'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useSession } from './session';
import * as remote from './rooms-remote';
import { visible, type Cover, type Message, type Role, type Room, type StickerId } from './rooms-core';

/* What the rooms screens import. Rooms need an account: signed in, every
   room, member and message comes from Supabase through lib/rooms-remote.ts
   (the same tables and RPCs as the current app); signed out there are none,
   and the screens say so with a way to sign in.

   Rooms made on this device before the server pass are left untouched in
   storage (mylo.rooms.*), never shown next to server rooms. */

export * from './rooms-core';
export { errText } from './rooms-remote';

const noSub = () => () => {};

/* Every rooms hook goes through here, so the store follows sign-in. */
export function useRooms() {
  const { loading, user } = useSession();
  const uid = user?.id ?? null;
  const hydrated = useSyncExternalStore(noSub, () => true, () => false);
  useEffect(() => { if (!loading) { remote.wire(); remote.attach(uid); } }, [loading, uid]);
  const s = useSyncExternalStore(remote.subscribe, remote.snapshot, remote.serverSnapshot);
  const mine = !!uid && s.uid === uid;
  const signedOut = hydrated && !loading && !uid;
  const failed = mine && s.status === 'error';
  /* False while signed out or failed: screens check signedOut and error first. */
  const ready = hydrated && !loading && mine && s.status === 'ready';
  return {
    ready, signedOut, error: failed ? s.error ?? 'Something went wrong' : null, retry: remote.reload,
    rooms: mine ? s.rooms : [], messages: mine ? s.messages : {}, recent: s.recent as StickerId[],
    snap: s
  };
}

/* One room: mine (with its messages), or one I can only see the face of. */
export function useRoom(id: string) {
  const r = useRooms();
  const spaceId = r.snap.spaceOf[id] ?? id;
  const own = r.rooms.find(x => x.id === spaceId);
  const room = own ?? (r.ready && !r.signedOut ? r.snap.peeks[spaceId] : undefined);
  const listReady = r.ready && !r.signedOut;
  const isOwn = !!own;
  const known = !!room;
  useEffect(() => {
    if (!listReady) return;
    if (isOwn) remote.openRoom(spaceId);
    else if (!known) void remote.peek(spaceId);
  }, [listReady, isOwn, known, spaceId]);
  const peekDone = r.snap.peekStatus[spaceId] === 'ready' || r.snap.peekStatus[spaceId] === 'error';
  const all = own ? r.messages[spaceId] ?? [] : [];
  const status: remote.Status = own ? r.snap.roomStatus[spaceId] ?? 'loading' : 'ready';
  return {
    /* False while signed out or failed: screens check signedOut and error first. */
    ready: listReady && (!!room || peekDone),
    signedOut: r.signedOut, error: r.error, retry: r.retry,
    room, messages: visible(all, room), all,
    status, roomError: r.snap.roomError[spaceId] ?? null, retryRoom: () => remote.retryRoom(spaceId),
    more: r.snap.more[spaceId] ?? false, loadingOlder: !!r.snap.older[spaceId],
    loadOlder: () => remote.loadOlder(spaceId)
  };
}

/* LB6: rooms that asked to be found, by category ('All' for every one). */
export function useDirectory(category: string) {
  const r = useRooms();
  const key = category === 'All' ? null : category;
  const listReady = r.ready && !r.signedOut;
  useEffect(() => { if (listReady) void remote.browse(key); }, [listReady, key]);
  const d = r.snap.directory[category];
  const list = (d?.ids ?? []).map(id => r.rooms.find(x => x.id === id) ?? r.snap.peeks[id]).filter((x): x is Room => !!x);
  return { ...r, list, status: (d?.status ?? 'loading') as remote.Status, dirError: d?.error ?? null, reloadDir: () => remote.browse(key) };
}

/* ── Actions. Each returns a promise that rejects with a message to show. ── */
type Patch = Partial<Room>;
export const rooms = {
  create: (name: string) => remote.create(name),
  joinByCode: (code: string) => remote.joinByCode(code),
  peekCode: (code: string) => remote.peekCode(code),
  ask: (id: string) => remote.requestById(id),
  leave: (id: string) => remote.leave(id),
  refreshRequests: (id: string) => remote.refreshRequests(id),
  /* Shared settings go to the server; the rest are this device's own. */
  async update(id: string, patch: Patch) {
    const local: Parameters<typeof remote.setPrefs>[1] = {};
    if ('colour' in patch) local.colour = patch.colour;
    if ('wallpaper' in patch) local.wallpaper = patch.wallpaper ?? null;
    if ('notify' in patch) local.notify = patch.notify;
    if ('readReceipts' in patch) local.readReceipts = patch.readReceipts;
    if ('pinned' in patch) local.pinned = patch.pinned;
    if (Object.keys(local).length) remote.setPrefs(id, local);
    if (patch.name !== undefined) await remote.rename(id, patch.name);
    if (patch.about !== undefined || patch.findable !== undefined) await remote.setListing(id, { about: patch.about, findable: patch.findable });
    if (patch.cover) await remote.setCover(id, patch.cover as Cover);
    if (patch.muted !== undefined) await remote.setMuted(id, patch.muted);
  },
  setRequestDecision: (id: string, requestId: string, letIn: boolean) => remote.decide(id, requestId, letIn),
  setRole: (id: string, memberId: string, role: Role) => remote.setRole(id, memberId, role),
  remove: (id: string, memberId: string) => remote.removeMember(id, memberId)
};

type Outgoing = Omit<Message, 'id' | 'roomId' | 'authorId' | 'authorName' | 'at'>;
export const msgs = {
  send: (roomId: string, m: Outgoing, blob?: Blob) => remote.send(roomId, m, blob),
  removeForEveryone: (roomId: string, id: string) => remote.removeForEveryone(roomId, id),
  removeForMe: (roomId: string, id: string) => remote.removeForMe(roomId, id),
  vote: (roomId: string, id: string, option: number) => remote.vote(roomId, id, option),
  opened: (roomId: string, id: string) => remote.opened(roomId, id),
  markRead: (roomId: string) => remote.markRead(roomId),
  /* Pins are kept on this device: the server has no shared pin. */
  togglePin(roomId: string, id: string, pinned: string[]) {
    remote.setPrefs(roomId, { pinned: pinned.includes(id) ? pinned.filter(p => p !== id) : [...pinned, id] });
  }
};

/* A voice note's clip is its URL (the bucket's public URL once sent, a blob
   URL while it uploads). */
export const voiceClips = {
  get: (clip: string) => (/^(https?:|blob:)/.test(clip) ? clip : undefined)
};

