import '@/styles/system.css';

/* Skeletons, S19–S22: grey shapes where content is about to land, so a
   screen never jumps. Show one while the data loads, then swap it out.

   <Skeleton variant="today" />    S19 · title, date line and 5 task cards
   <Skeleton variant="feed" />     S20 · 2 post cards (render your own Vibe header and tabs above)
   <Skeleton variant="chats" />    S21 · 7 chat rows (render your own "Chats" title above)
   <Skeleton variant="profile" />  S22 · cover, name, chips, stats, tabs, cards
   <Skeleton variant="today" count={3} />   fewer or more repeats

   <Bone w={120} h={30} r={8} />   one shape, for drawing your own. */

export function Bone({ w, h, r = 8, style }: { w?: number | string; h: number; r?: number; style?: React.CSSProperties }) {
  return <span className="sk" style={{ width: w ?? '100%', height: h, borderRadius: r, ...style }} />;
}

export default function Skeleton({ variant, count }: { variant: 'today' | 'feed' | 'chats' | 'profile'; count?: number }) {
  const label = { today: 'Loading today', feed: 'Loading posts', chats: 'Loading chats', profile: 'Loading profile' }[variant];
  return (
    <div className="sk-col" role="status" aria-busy="true" aria-label={label}>
      {variant === 'today' && (
        <>
          <Bone w={120} h={30} />
          <Bone w={180} h={14} style={{ marginTop: 10 }} />
          <div className="sk-col" style={{ gap: 8, marginTop: 24 }}>
            {Array.from({ length: count ?? 5 }, (_, i) => (
              <div key={i} className="sk-today-card">
                <Bone w={24} h={24} r={12} />
                <span className="sk-col" style={{ gap: 10, flex: 1 }}><Bone w={170} h={14} /><Bone w={110} h={10} /></span>
              </div>
            ))}
          </div>
        </>
      )}
      {variant === 'feed' && (
        <div className="sk-col" style={{ gap: 12, margin: '0 -4px' }}>
          {Array.from({ length: count ?? 2 }, (_, i) => (
            <div key={i} className="sk-post">
              <div className="sk-post-head">
                <Bone w={36} h={36} r={18} />
                <span className="sk-col" style={{ gap: 8 }}><Bone w={100} h={12} /><Bone w={70} h={10} /></span>
              </div>
              <Bone h={150} r={16} style={{ marginTop: 18 }} />
              <Bone w={200} h={12} style={{ marginTop: 16 }} />
              <Bone w={140} h={10} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}
      {variant === 'chats' && (
        <div className="sk-col" style={{ gap: 24, marginTop: 4 }}>
          {Array.from({ length: count ?? 7 }, (_, i) => (
            <div key={i} className="sk-chat">
              <Bone w={52} h={52} r={26} />
              <span className="sk-col" style={{ gap: 10, flex: 1 }}><Bone w={150} h={14} /><Bone w="72%" h={10} /></span>
              <Bone w={40} h={10} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}
      {variant === 'profile' && (
        <>
          <Bone h={300} r={0} style={{ margin: 'calc(-12px - env(safe-area-inset-top)) -20px 0', width: 'calc(100% + 40px)' }} />
          <Bone w={160} h={24} style={{ marginTop: 20 }} />
          <Bone w={220} h={12} style={{ marginTop: 12 }} />
          <div className="sk-grid" style={{ marginTop: 24 }}>{[0, 1, 2].map(i => <Bone key={i} h={36} r={18} />)}</div>
          <div className="sk-grid" style={{ marginTop: 22 }}>{[0, 1, 2].map(i => <Bone key={i} h={70} r={16} />)}</div>
          <Bone h={40} r={20} style={{ marginTop: 20 }} />
          <div className="sk-grid" style={{ marginTop: 20 }}>{Array.from({ length: count ?? 3 }, (_, i) => <Bone key={i} h={150} r={16} />)}</div>
        </>
      )}
    </div>
  );
}
