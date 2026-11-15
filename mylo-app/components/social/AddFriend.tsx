'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import { qr } from './qr';
import { Avatar, SIcon, useToast } from './ui';
import { cleanHandle, inviteUrl, shareLink, useBlocked, useFriends, useMe } from '@/lib/social';
import { useHydrated } from '@/lib/local';
import { goBack } from '@/components/NavMotion';

/* FR2 · Add a friend: search by username, your own code to scan, share an
   invite link, or scan a friend's code. An invite link opens here with their
   username filled in, ready to add. */
function Code({ text }: { text: string }) {
  const cells = useMemo(() => qr(text), [text]);
  const n = cells.length, hole = Math.ceil(n * 0.26) | 1, lo = (n - hole) / 2, hi = lo + hole;
  return (
    <svg className="sx-qr-svg" viewBox={`0 0 ${n} ${n}`} role="img" aria-label="Your friend code">
      {cells.flatMap((row, y) => row.map((on, x) => (on && !(x >= lo && x < hi && y >= lo && y < hi))
        ? <rect key={`${x}.${y}`} x={x + 0.06} y={y + 0.06} width={0.88} height={0.88} rx={0.18} /> : null))}
    </svg>
  );
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;
function Scanner({ open, onClose, onFound }: { open: boolean; onClose: () => void; onFound: (handle: string) => void }) {
  const hydrated = useHydrated();
  const video = useRef<HTMLVideoElement>(null);
  const found = useRef(onFound);
  useEffect(() => { found.current = onFound; }, [onFound]);
  const [state, setState] = useState<'idle' | 'on' | 'denied'>('idle');
  const Ctor = hydrated ? (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector : undefined;
  const supported = !!Ctor && !!navigator.mediaDevices?.getUserMedia;
  useEffect(() => {
    if (!open || !Ctor || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null, t: ReturnType<typeof setTimeout> | undefined, live = true;
    const det = new Ctor({ formats: ['qr_code'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
      if (!live) { s.getTracks().forEach(x => x.stop()); return; }
      stream = s; setState('on');
      const v = video.current!; v.srcObject = s; v.play().catch(() => {});
      const tick = async () => {
        if (!live) return;
        try {
          const codes = v.readyState >= 2 ? await det.detect(v) : [];
          const hit = codes.map(f => { try { return new URL(f.rawValue).searchParams.get('u'); } catch { return null; } }).find(Boolean);
          if (hit) { found.current(hit); return; }
        } catch { /* keep looking */ }
        t = setTimeout(tick, 280);
      };
      tick();
    }).catch(() => { if (live) setState('denied'); });
    return () => { live = false; clearTimeout(t); stream?.getTracks().forEach(x => x.stop()); };
  }, [open, Ctor]);
  return (
    <Sheet open={open} onClose={() => { setState('idle'); onClose(); }} title="Scan a code" sub="Friends scan this to add you" labelId="sx-scan">
      <div className="sx-scan">
        <video ref={video} playsInline muted className={state === 'on' ? '' : 'sx-hide'} />
        {hydrated && !supported && <p className="t-body c-2">This browser cannot scan codes. Ask your friend to share their invite link.</p>}
        {state === 'denied' && <p className="t-body c-2">Mylo needs the camera to scan a code.</p>}
      </div>
    </Sheet>
  );
}

export default function AddFriend() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const me = useMe();
  const [friends, setFriends] = useFriends();
  const [blocked, setBlocked] = useBlocked();
  const [q, setQ] = useState(() => cleanHandle(params.get('u') ?? ''));
  const [scan, setScan] = useState(false);
  const [toastNode, toast] = useToast();
  const handle = cleanHandle(q);
  const already = friends.some(f => f.handle === handle);
  const self = handle === me.handle;

  const add = () => {
    if (!handle || already || self) return;
    setFriends(f => [...f, { handle, name: handle, addedAt: Date.now() }]);
    if (blocked.includes(handle)) setBlocked(b => b.filter(h => h !== handle));
    toast(`@${handle} added`, { href: '/friends', action: 'View' });
  };

  return (
    <main className="screen on-desk sx-full sx-add">
      <header className="screen-header">
        <button type="button" className="back-btn" aria-label="Close" onClick={() => (window.history.length > 1 ? goBack(router) : router.push('/friends'))}><SIcon name="close" size={20} /></button>
        <h1 className="screen-header-title">Add a friend</h1>
        <div className="screen-header-actions" />
      </header>

      <form className="sx-find" onSubmit={e => { e.preventDefault(); add(); }}>
        <SIcon name="search" size={24} className="c-3" />
        <label className="sr-only" htmlFor="sx-user">Search by username</label>
        <input id="sx-user" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by username" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
      </form>
      {hydrated && handle && (
        <div className="sx-result">
          <Avatar name={handle} size={40} />
          <span className="sx-result-text t-title-s">@{handle}</span>
          <button type="button" className="sx-pill" aria-checked={already} role="switch" disabled={already || self} onClick={add}>{self ? 'You' : already ? 'Added' : 'Add'}</button>
        </div>
      )}

      <section className="sx-qr-card">
        <div className="sx-qr">
          {hydrated && <Code text={inviteUrl(me.handle)} />}
          <img className="sx-qr-mylo" src="/figma/social/mylo-qr.svg" alt="" width={42} height={50} />
        </div>
        <p className="sx-qr-handle">@{hydrated ? me.handle : ''}</p>
        <p className="t-body-s c-2">Friends scan this to add you</p>
      </section>

      <button type="button" className="btn-primary sx-wide" onClick={async () => {
        const r = await shareLink(inviteUrl(me.handle), 'Add me on Mylo');
        if (r === 'copied') toast('Link copied');
      }}><SIcon name="fr-link" size={20} />Share invite link</button>
      <button type="button" className="sx-btn-soft sx-wide is-2" onClick={() => setScan(true)}><SIcon name="fr-camera" size={20} />Scan a code</button>

      <p className="sx-note"><SIcon name="fr-shield" size={24} className="c-3" />Only people you accept can see your Mylo, your house and your photos.</p>

      <Scanner open={scan} onClose={() => setScan(false)} onFound={h => { setScan(false); setQ(cleanHandle(h)); }} />
      {toastNode}
    </main>
  );
}
