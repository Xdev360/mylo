/* Line icons at the handoff's weight: 1.6 at 24, currentColor, no fill.
   These stand in for the Figma Icon set until it can be exported. */
type P = { className?: string; size?: number };
const base = (size = 24) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const
});

export const IconHome = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" /></svg>
);
export const IconHeart = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 20.3 4.6 13a4.4 4.4 0 0 1 6.2-6.2l1.2 1.2 1.2-1.2a4.4 4.4 0 0 1 6.2 6.2z" /></svg>
);
export const IconSteps = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 18h5v-5h5V8h6" /><circle cx="4" cy="18" r="1.4" /><circle cx="20" cy="8" r="1.4" /></svg>
);
export const IconCalendar = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3.5" y="5" width="17" height="16" rx="3" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" /></svg>
);
export const IconPlay = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M10.2 9.3 15 12l-4.8 2.7z" /></svg>
);
export const IconSpark = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 10.9 10.1 9z" /></svg>
);
export const IconShield = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3.5 19 6v6c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6z" /><path d="m9.2 12 2 2 3.6-3.8" /></svg>
);
export const IconQuestion = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.8c0 1.6-2.2 1.9-2.2 3.3" /><path d="M12 17.2h.01" /></svg>
);
export const IconMap = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M9 4.5 3.5 6.7v12.8L9 17.3l6 2.2 5.5-2.2V4.5L15 6.7z" /><path d="M9 4.5v12.8M15 6.7v12.8" /></svg>
);
export const IconMail = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3" y="5.5" width="18" height="13" rx="3" /><path d="m3.8 7.5 7.4 5.2a1.4 1.4 0 0 0 1.6 0l7.4-5.2" /></svg>
);
export const IconMenu = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconClose = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconPlus = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);

export const NAV_ICON = {
  hero: IconHome, why: IconHeart, how: IconSteps, plan: IconCalendar,
  rewards: IconPlay, playground: IconSpark, safety: IconShield,
  questions: IconQuestion, roadmap: IconMap, join: IconMail
} as const;
