'use client';

import { useSyncExternalStore } from 'react';
import FigIcon from './FigIcon';
import { applyTheme, storedTheme, systemTheme, type Theme } from '@/lib/theme';

/* Light and Dark side by side, the shown scheme lit up as the sidebar's
   current page is: a sheet-white pill with the two-layer shadow, which slides
   across when you switch. Until someone picks, it shows whichever the system
   is using. No frame draws it; it is built from the sidebar's own pieces.

   On the folded sidebar only the other scheme's icon is left, so it reads as
   one button that swaps. */

function subscribe(cb: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  window.addEventListener('mylo-theme', cb);
  window.addEventListener('storage', cb);
  return () => {
    mq.removeEventListener('change', cb);
    window.removeEventListener('mylo-theme', cb);
    window.removeEventListener('storage', cb);
  };
}
const current = (): Theme => storedTheme() ?? systemTheme();

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' }
];

export default function ThemeSwitch({ className = '' }: { className?: string }) {
  // The server cannot know; it renders neither as on, and the first client
  // render corrects it before anyone can look.
  const theme = useSyncExternalStore<Theme | null>(subscribe, current, () => null);
  return (
    <div role="group" aria-label="Appearance" data-on={theme ?? undefined} className={`theme-switch ${className}`}>
      {OPTIONS.map(o => (
        <button key={o.value} type="button" aria-pressed={theme === o.value}
                className={theme === o.value ? 'is-on' : undefined}
                data-tip={o.label} onClick={() => applyTheme(o.value)}>
          <FigIcon name={o.icon} />
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
