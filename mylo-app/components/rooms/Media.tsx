'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import { ImageViewer } from './ChatSheets';
import { Waveform } from './Bubble';
import { Gate, RIcon } from './ui';
import { useGone } from './ChatSettings';
import { ME, dayLabel, stamp, useRoom, voiceClips, type Message } from '@/lib/rooms';

/* CT20 · Media, voice and files: what the chat has shared, newest first. */
export default function Media({ id }: { id: string }) {
  const router = useRouter();
  const { ready, signedOut, error, retry, room, messages } = useRoom(id);
  const [tab, setTab] = useState<'Media' | 'Voice' | 'Files'>('Media');
  const [open, setOpen] = useState<{ m: Message; from: HTMLImageElement | null } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useGone(ready, room && !room.peek ? room : null);
  if (!ready || !room || room.peek) return <Gate signedOut={signedOut} error={error} retry={retry} />;
  const live = messages.filter(m => !m.deleted).reverse();
  const photos = live.filter(m => m.kind === 'photo');
  const voices = live.filter(m => m.kind === 'voice');
  const groups = (list: Message[]) => list.reduce<{ label: string; items: Message[] }[]>((acc, m) => {
    const week = Date.now() - Date.parse(m.at) < 7 * 864e5 ? 'This week' : new Date(m.at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const g = acc.find(x => x.label === week); if (g) g.items.push(m); else acc.push({ label: week, items: [m] });
    return acc;
  }, []);

  return (
    <main className="screen on-desk r-media">
      <ScreenHeader title="Media" fallback={`/chats/${room.id}/settings`} />
      <div className="r-seg" role="tablist" aria-label="Show" style={{ '--i': ['Media', 'Voice', 'Files'].indexOf(tab), '--n': 3 } as React.CSSProperties}>
        {(['Media', 'Voice', 'Files'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Media' && groups(photos).map(g => (
        <section key={g.label} className="r-media-group">
          <h2 className="r-media-label">{g.label}</h2>
          <div className="r-media-grid">
            {g.items.map(m => {
              const gone = m.photo!.once || !m.photo!.src;
              return (
                <button key={m.id} type="button" className={`r-media-tile${gone ? ' is-once' : ''}`} disabled={gone} onClick={e => setOpen({ m, from: e.currentTarget.querySelector('img') })}
                        aria-label={m.photo!.once ? 'View once photo' : m.photo!.caption || 'Photo'}>
                  {!gone && <img src={m.photo!.src} alt="" />}
                  {m.photo!.once && <span className="r-media-once">1</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {tab === 'Voice' && voices.length > 0 && (
        <div className="card list r-voicelist">
          {voices.map(m => {
            const url = voiceClips.get(m.voice!.clip);
            return (
              <div key={m.id} className="r-voicerow">
                <button type="button" className="r-voice-play" aria-label="Play" disabled={!url} onClick={() => {
                  if (!url) return; const a = new Audio(url); setPlaying(m.id); a.onended = () => setPlaying(null); a.play();
                }}><RIcon name={playing === m.id ? 'pause' : 'play'} size={20} /></button>
                <span className="r-voicerow-text"><span className="t-body">{m.authorId === ME ? 'You' : m.authorName}</span><span className="t-caption c-3">{dayLabel(m.at)} · {stamp(m.at)}</span></span>
                <Waveform bars={m.voice!.bars} count={20} />
              </div>
            );
          })}
        </div>
      )}
      {tab === 'Media' && photos.length === 0 && <p className="t-body c-2 r-empty-note">Photos shared in {room.name} show up here.</p>}
      {tab === 'Voice' && voices.length === 0 && <p className="t-body c-2 r-empty-note">No voice notes yet. Hold the mic in the chat to send one.</p>}
      {tab === 'Files' && <p className="t-body c-2 r-empty-note">Files are not in rooms yet. Photos and voice notes have their own tabs.</p>}
      {open && <ImageViewer m={open.m} from={open.from} onClose={() => setOpen(null)} onCheer={() => router.push(`/chats/${room.id}#m-${open.m.id}`)} onReply={() => router.push(`/chats/${room.id}#m-${open.m.id}`)} />}
    </main>
  );
}
