/* ──────────────────────────────────────────────────────────────────────────
   Every word on the site, in one file.

   All of it is copied from the Figma page "Mylo · Launch", frame by frame,
   and each block names the frame it came from. Nothing here is written
   from scratch: if a frame does not say it, the site does not either.
   ────────────────────────────────────────────────────────────────────────── */

/** true from 3 December. Until then the site is a waitlist and nothing else.
    Set by the LAUNCHED env variable, which next.config inlines at build
    time, so flipping it takes a redeploy and nothing else. */
export const LAUNCHED = process.env.LAUNCHED === 'true';

export const SITE = {
  title: 'Mylo · Goals with your people',
  // SEO description is the hero lead, per the handoff
  appUrl: 'https://app.staymylo.com',
  madeBy: '© 2026 Mylo · Made by Wintech Studio'
};

/* The sidebar, the mobile menu and their order, from Figma "Sidebar"
   (887:5340) and "Menu sheet" (893:117878). The nav goes to pages, not to
   anchors on one long page, How it works, Rewards, Playground and
   Questions each have their own frame. */
export const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/',             label: 'Home',         icon: 'home' },
  { href: '/how-it-works', label: 'How it works', icon: 'nav-done' },
  { href: '/rewards',      label: 'Rewards',      icon: 'nav-gift' },
  { href: '/playground',   label: 'Playground',   icon: 'nav-games' },
  { href: '/safety',       label: 'Safety',       icon: 'nav-shield' },
  { href: '/questions',    label: 'Questions',    icon: 'help' },
  { href: '/roadmap',      label: 'Roadmap',      icon: 'calendar' }
];

/* "GET IN" in the sidebar. Report a bug is for testers, not a stop on the
   tour, so it lives in the footer and on Help rather than in the navigation. */
export const GET_IN = {
  label: 'GET IN',
  join: { label: 'Join the waitlist', icon: 'sparkle', href: '/#join' },
  message: { label: 'Message us', icon: 'nav-send', href: 'mailto:hello@staymylo.com' },
  bug: { label: 'Report a bug', icon: 'alert', href: '/report-a-bug' }
};

/* The bottom of the sidebar. The crew is decoration: five initials in the
   colours Figma gives them, standing in for the people already waiting. */
export const ALREADY_IN = {
  label: 'ALREADY IN THE WAITLIST',
  /* The real count from waitlist_count(), shown once it reads as momentum.
     Below this the block stays away. The crew below is no longer drawn: five
     made-up initials are not people. */
  showFrom: 100,
  crew: [
    { initial: 'A', color: '#E2594B' },
    { initial: 'T', color: '#2FA36B' },
    { initial: 'S', color: '#3E7BFA' },
    { initial: 'M', color: '#D99A1E' },
    { initial: 'K', color: '#7A5CD9' }
  ],
  madeBy: 'Made by Wintech Studio'
};

/* Read from the Figma frame "01 Hero" (887:4). The headline alternates ink
   and #a3a3ab across four runs, so it is kept as parts rather than one
   string, the greys are the design, not emphasis anyone can re-derive. */
export const HERO = {
  panelAlt: "Three Mylo screens: a shared room, today's plan and the rewards hub, with two Mylos beside them.",
  /* The eyebrow is two runs: the first in text-3, the second in ink. On
     launch day (1109:2475) it is one text-3 run. */
  eyebrow: LAUNCHED
    ? ['NOW OPEN  ·  FREE ON THE WEB', '']
    : ['PRE-LAUNCH  ·  ', 'OPENS 3 DECEMBER'],
  /* "The [icon] goal app for people who do better together." Wide screens
     (887:6, 887:14) break after "for people" and grey out "for people" and
     "who do better"; the phone (887:185099, 887:185107) breaks after
     "goal app" and greys out "for people who do". */
  h1: { first: 'The', afterIcon: 'goal app', forPeople: 'for people', whoDo: 'who do', better: 'better', together: 'together.' },
  lead: 'Plan your day, build small daily systems and share a private room with your friends. Show up all week and Mylo gives you a key for the Sunday chest.',
  cta: LAUNCHED ? 'Open Mylo' : 'Join the waitlist',
  secondaryCta: 'See how it works'
};

/* Read from the Figma frame "02 Why we built it" (887:1037). The opening
   line alternates ink and #a3a3ab the way the hero headline does, so it is
   kept as runs; the greys carry the rhythm and are not emphasis. */
export const WHY = {
  intro: [
    { text: 'Every plan starts strong. ', dim: false },
    { text: 'A list, a new notebook, a feeling that this time is different. ', dim: true },
    { text: 'Then life happens. ', dim: false },
    { text: 'Nobody checks on you, and the plan goes quiet.', dim: true }
  ],
  headingBefore: "That's why we built",
  headingAfter: 'Mylo'
};

/* Read from the Figma frames "03 Half plan, half play" (887:1648) and its
   mobile twin (887:186697). The phone is not the desktop text shortened by
   CSS, the design writes a tighter line for each point, so both are here
   and the component picks one. */
export const HOW = {
  eyebrow: 'HOW IT WORKS',
  titleParts: [
    { text: 'Half of Mylo gets things done.', dim: false },
    { text: ' The other half makes you come back.', dim: true }
  ],
  seam: 'What you finish earns what you play with',
  plan: {
    chip: 'Plan',
    chipIcon: 'done',
    title: 'Get your days in order.',
    points: [
      { icon: 'done',   name: 'Today',
        wide: 'One short list. Tick it and your room sees it.',
        phone: 'One short list. Your room sees it.' },
      { icon: 'goals',  name: 'Goals',
        wide: 'Big goals broken into small, weekly steps.',
        phone: 'Big goals, small weekly steps.' },
      { icon: 'repeat', name: 'Systems',
        wide: 'Routines that land on Today by themselves.',
        phone: 'Routines land on Today.' },
      { icon: 'room',   name: 'Rooms',
        wide: 'A private room for the people who keep you going.',
        phone: 'A private room for your people.' }
    ]
  },
  play: {
    chip: 'Play',
    chipIcon: 'games',
    title: 'Stay because it feels good.',
    points: [
      { icon: 'key',   name: 'Keys',
        wide: 'Show up 5 days in a week and you earn one.',
        phone: '5 active days earns one.' },
      { icon: 'gift',  name: 'Sunday chest',
        wide: 'One key opens it. It gets better every week you stay.',
        phone: 'Better every week you stay.' },
      { icon: 'shirt', name: '30 outfits',
        wide: 'Cards for your Mylo, from cozy to legendary.',
        phone: 'From cozy to legendary.' },
      { icon: 'egg',   name: 'Pets',
        wide: 'Eggs hatch into a buddy that walks with you.',
        phone: 'Eggs hatch into a buddy.' }
    ]
  }
};

/* Read from the Figma frames "04 Plan" (887:2482) and its mobile twin
   (887:187480). The phone writes a shorter line for each tile, and it drops
   the calendar tile from the swipe row entirely. */
export const PLAN = {
  eyebrow: 'PLAN',
  titleParts: [
    { text: 'Everything for the day.', dim: false },
    { text: ' Nothing extra.', dim: true }
  ],
  leadWide: 'No dashboards to maintain. Mylo keeps one list for today, pulls in your routines, and quietly tells your room when you finish.',
  leadPhone: 'One list for today. Mylo pulls in your routines and tells your room when you finish.',
  tiles: [
    { key: 'today', size: 'lg' as const, shot: 'plan-today',
      title: 'Today, in one list',
      wide: 'Tasks, routines and shared plans in one short list. Tick one and get a little burst.',
      phone: 'Tick one and get a little burst.',
      alt: "Mylo's Today screen the moment a task is ticked." },
    { key: 'rooms', size: 'lg' as const, shot: 'plan-rooms',
      title: 'A room for your people',
      wide: 'Friends, a study group, your gym crew. Everyone sees who showed up today. Private tasks stay private.',
      phone: 'Everyone sees who showed up.',
      alt: 'A shared room: 11 of 26 done, with each person and what they have left.' },
    { key: 'ai', size: 'sm' as const, shot: 'plan-ai',
      title: 'Mylo plans with you',
      wide: 'Tell it what is on your mind. It drafts a plan you can edit.',
      phone: 'It drafts a plan you can edit.',
      alt: 'A chat with Mylo turning a messy brain-dump into a plan for Friday.' },
    { key: 'focus', size: 'sm' as const, shot: 'plan-focus',
      title: 'Focus timer',
      wide: 'Start a task, put the phone down. Your room sees you focusing.',
      phone: 'Your room sees you focusing.',
      alt: 'A focus timer counting down 65 minutes 41 seconds of a 90-minute block.' },
    { key: 'calendar', size: 'sm' as const, shot: 'plan-calendar', wideOnly: true,
      title: "Who's free when",
      wide: 'See the day for everyone in your room, then plan together.',
      phone: '',
      alt: "A day timeline showing when everyone in the room is free." }
  ]
};

/* Read from the Figma frames "05 Play" (887:3041) and its mobile twin
   (887:187955). Four blocks: the five steps, the chest ladder, the wardrobe
   lineup and the fairness panel. The phone writes a shorter line for every
   step and for the two panel leads. */
export const PLAY = {
  eyebrow: 'PLAY',
  titleParts: [
    { text: 'One key. One chest.', dim: false },
    { text: ' A week at a time.', dim: true }
  ],
  leadWide: 'Rewards come from showing up, not from paying. Everything you can win has a label that says where it comes from.',
  leadPhone: 'Rewards come from showing up, not from paying. Every item says where it comes from.',
  steps: [
    { n: '01', title: 'Show up',        wide: '5 active days in a week.',            phone: '5 active days.' },
    { n: '02', title: 'Earn a key',     wide: 'One key a week, or one on level up.', phone: 'One a week.' },
    { n: '03', title: 'Open the chest', wide: 'Every Sunday, one key, one chest.',   phone: 'Every Sunday.' },
    { n: '04', title: 'Collect',        wide: 'Outfit cards and eggs.',              phone: 'Cards and eggs.' },
    { n: '05', title: 'Hatch',          wide: 'Eggs hatch into a buddy.',            phone: 'A buddy.' }
  ],
  ladder: {
    title: 'The longer you stay, the better the chest.',
    leadWide: 'Miss a whole week and it drops one level. Nothing you own is ever taken.',
    leadPhone: 'Miss a whole week and it drops one level.',
    chip: 'Gold needs a perfect week',
    rungs: [
      /* The glow behind each chest is a radial wash the colour of the
         chest. Figma gives #C79A6A for the wooden one; the other two take
         their own metal, which is what the frame shows. */
      { shot: 'ladder-wood',   when: 'WEEK 1 TO 2',    name: 'Wood chest',   drops: 'Common cards',
        glow: '#C79A6A', alt: 'A closed wooden chest.' },
      { shot: 'ladder-silver', when: 'WEEK 3',         name: 'Silver chest', drops: 'Rare or better',
        glow: '#B9C4D6', alt: 'A closed silver chest.' },
      { shot: 'ladder-gold',   when: 'WEEK 4 AND ON',  name: 'Gold chest',   drops: 'Epic, Legendary, eggs 1 in 2',
        glow: '#F5C64A', alt: 'An open gold chest.' }
    ]
  },
  wardrobe: {
    title: 'Dress your Mylo.',
    leadWide: '30 outfits in Season 1, from everyday casual to legendary. Your friends see what you wear.',
    leadPhone: '30 outfits. Your friends see what you wear.',
    outfits: [
      { shot: 'mylo-winter',   name: 'Winter Cozy' },
      { shot: 'mylo-pilates',  name: 'Pink Pilates' },
      { shot: 'mylo-beach',    name: 'Beach Day' },
      { shot: 'mylo-doctor',   name: 'Doctor Mylo' },
      { shot: 'mylo-chef',     name: 'Head Chef' },
      { shot: 'mylo-festival', name: 'Festival Vibes' },
      { shot: 'mylo-space',    name: 'Space Cadet' }
    ]
  },
  fair: {
    title: 'Fair, every time.',
    points: [
      { icon: 'ban',    name: 'No buying',
        wide: 'Keys and chests cannot be bought.', phone: 'Keys and chests cannot be bought.' },
      { icon: 'eye',    name: 'Odds shown',
        wide: 'Every chest shows what it can drop.', phone: 'Every chest shows what it drops.' },
      { icon: 'repeat', name: 'Doubles become shards',
        wide: '5 shards pick any card you want.', phone: '5 shards pick any card.' },
      { icon: 'trophy', name: 'A Legendary is guaranteed',
        wide: 'Within 20 Gold chests.', phone: 'Within 20 Gold chests.' }
    ]
  }
};

/* Read from the Figma frames "07 Safety" (887:4601) and 887:189287. */
export const SAFETY_SECTION = {
  eyebrow: 'SAFETY',
  title: 'Built for small rooms you trust.',
  cards: [
    { icon: 'lock',   title: 'Private by default',
      wide: 'Rooms are invite only. Just me tasks never leave your phone.',
      phone: 'Rooms are invite only. Just me tasks never leave your phone.' },
    { icon: 'user',   title: 'You approve the photos',
      wide: 'Nothing with your face goes to a room without your say.',
      phone: 'Nothing with your face goes to a room without your say.' },
    { icon: 'shield', title: '13 and up',
      wide: 'Report or leave any room in two taps. Real people review reports.',
      phone: 'Report or leave any room in two taps.' }
  ]
};

/* Read from "08 Questions" (887:4619) and 887:189305. The phone frame drops
   the pets question for space; it is kept here, because an answer someone
   is looking for should not depend on the size of their screen. */
export const QUESTIONS = {
  eyebrow: 'QUESTIONS',
  title: 'Good questions.',
  lead: 'Still unsure? Message us and a real person answers.',
  cta: 'Message us',
  ctaHref: 'mailto:hello@staymylo.com'
};

/* Read from "08b Roadmap teaser" (887:190873). */
export const ROADMAP_TEASER = {
  eyebrow: 'ROADMAP',
  titleParts: [
    { text: 'Small at launch.', dim: false },
    { text: ' Bigger every month.', dim: true }
  ],
  lead: 'One daily loop on day one. New things open as you level up, so it never feels like too much.',
  cta: 'See the roadmap',
  cards: [
    { when: 'AT LAUNCH',  name: 'Launch 1',   body: 'Plan, tick, close the day',
      badge: 'badge-launch', pin: 'roadmap-pin-1', rot: 1.2 },
    { when: 'SOON AFTER', name: 'Update 1.1', body: 'Games and challenges',
      badge: 'badge-11',     pin: 'roadmap-pin-2', rot: -1 },
    { when: 'LATER',      name: '1.2 and on', body: 'Pets, a feed and more',
      badge: 'badge-12',     pin: 'roadmap-pin-3', rot: 0.8 }
  ]
};

/* Read from "09 Waitlist" (887:4645) and 887:189327. */
export const JOIN = {
  titleParts: [
    { text: "Your goals don't need another app.", dim: false },
    { text: ' They need your people.', dim: true }
  ],
  leadWide: 'Join the waitlist. Testers get the app first, then everyone else in the order they joined.',
  leadPhone: 'Testers get the app first, then everyone else in the order they joined.',
  /* "Web · Closing CTA · launch day" (1109:4480): the same title, a new
     line under it and a note in place of the form's hint. */
  launchLead: 'Free on the web today. iPhone and Android are next.',
  launchNote: 'Works on your phone and your computer.',
  /* The crowd along the bottom of the panel: five on a wide screen, three
     on a phone, each at the size and offset the frame gives it. */
  crowd: [
    { shot: 'mylo-winter', name: 'Winter Cozy', d: [90, 520, 158, 190], m: [-10, 470, 108, 130] },
    { shot: 'mylo-ballet', name: 'Ballet Day',  d: [250, 540, 142, 170], m: null },
    { shot: 'mylo-party',  name: 'Party Host',  d: [400, 500, 175, 210], m: [110, 450, 125, 150] },
    { shot: 'mylo-gala',   name: 'Gala Night',  d: [580, 530, 158, 190], m: [240, 470, 108, 130] },
    { shot: 'mylo-space',  name: 'Space Cadet', d: [750, 520, 158, 190], m: null },
    { shot: 'pip-classic', name: 'a pet called Pip',  d: [360, 650, 80, 80], m: null },
    { shot: 'momo-sky',    name: 'a pet called Momo', d: [920, 640, 80, 80], m: null }
  ] as { shot: string; name: string; d: number[]; m: number[] | null }[]
};

/* Read from the Figma frames "06 Playground" (887:3843) and its mobile
   twin (887:188611). Each toy carries its place on both canvases: the
   wide one is 1000x770, the phone's is 345x600, and the phone leaves out
   the egg, the list, the gift, the note and the shake-me chip.

   The four swatches are Figma's own (#C83A3A, #1FA3A0, #FFD23F, #B9A3F0).
   Each one gets an outfit from the Mylo set and a stage washed in its own
   colour, which is the same recipe the drawn stage uses for the first. */
export const PLAYGROUND = {
  eyebrow: 'PLAYGROUND',
  // Ink then grey, as 887:3843 and 887:188611 set it.
  titleParts: [{ text: 'Go on, ' }, { text: 'pull things around.', dim: true }],
  leadWide: 'Everything here floats. Grab a piece, throw it, and it drifts back slowly. Tap one to play with it.',
  leadPhone: 'Everything floats. Drag a piece, let go, and it drifts back. Tap one to play.',
  dressUp: {
    title: 'Dress up',
    hint: 'Tap to try an outfit',
    outfits: [
      { swatch: '#C83A3A', shot: 'mylo-varsity',  stage: ['#FFE3E3', '#F7A8A8'], name: 'Varsity' },
      { swatch: '#1FA3A0', shot: 'mylo-beach',    stage: ['#E3FBFF', '#A8E8F7'], name: 'Beach Day' },
      { swatch: '#FFD23F', shot: 'mylo-chef',     stage: ['#FFF8E3', '#F7E2A8'], name: 'Head Chef' },
      { swatch: '#B9A3F0', shot: 'mylo-festival', stage: ['#EFE3FF', '#CFA8F7'], name: 'Festival Vibes' }
    ]
  },
  shakeMe: 'Shake me',
  eggDay: 'Day 4 of 5',
  petName: 'Pet Zap',
  today: {
    title: 'Today',
    rows: [
      { text: 'Morning run',   done: true },
      { text: 'Read 20 pages', done: true },
      { text: 'Gym with Tobi', done: false },
      { text: 'Plan the week', done: false }
    ]
  },
  gift: { title: 'Gift a card', to: 'Send to Sam', initial: 'S' },
  note: 'psst, drag me',
  polaroid: '12 days!',
  controls: 'Drag to explore'
};

/** Verbatim from the handoff. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'When does Mylo launch?',
    a: 'Testers get it first, then everyone on the waitlist in the order they joined.'
  },
  {
    q: 'Why can’t I get Gold chests straight away?',
    a: 'Gold chests are for people who keep showing up. Weeks 1 and 2 give a Wood chest, week 3 a Silver chest, and from week 4 a perfect week earns Gold.'
  },
  {
    q: 'Can I buy keys or cards?',
    a: 'No. Keys come from showing up 5 days in a week or from levelling up. Nothing in Mylo is for sale.'
  },
  {
    q: 'Can I have lots of pets?',
    a: 'Your pet house holds 6, and one walks with your Mylo at a time. Eggs hatch after 5 active days.'
  },
  {
    q: 'Can I give a card to a friend?',
    a: 'Yes, one card a week, to a friend who has been in a room with you for at least 7 days.'
  },
  {
    q: 'Is it free?',
    a: 'Yes. Mylo is free to use, and the daily loop will always be free.'
  }
];

/** Verbatim from the handoff's waitlist state table. */
export const WAITLIST = {
  hint: 'No spam. One email when it is your turn.',
  invalid: 'Enter a real email address.',
  sending: 'Joining…',
  doneButton: 'You are in',
  done: 'You are on the list. We will email you when it is your turn.',
  doneEmailed: 'You are on the list. Your confirmation is on its way to your inbox.',
  shareTitle: 'Move up the queue.',
  shareBody: 'Every friend who joins with your link puts you ahead of them.',
  shareText: 'I\u2019m on the Mylo waitlist, a private room for goals with the people you\u2019re doing life with. Join with my link and we both move up: ',
  copy: 'Copy',
  copied: 'Copied',
  already: 'You are already on the list. Nothing else to do.',
  placeholder: 'you@example.com',
  button: 'Join the waitlist'
};

export const FOOTER_LINKS = [
  { label: 'Safety', href: '/safety' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Help', href: '/help' },
  { label: 'Report a bug', href: '/report-a-bug' },
  { label: 'Contact', href: 'mailto:hello@staymylo.com' }
];

/* "Web · Roadmap" (879:194528), phone 879:194815. Six releases pinned to a
   board, each with its level badge and what lands in it, then a note.
   `rot` is the card's tilt on the wide board and on the phone board. */
export const ROADMAP_PAGE = {
  eyebrow: 'ROADMAP',
  title: 'What ships first. What comes next.',
  lead: 'Mylo starts small on purpose. One daily loop at launch, then one new thing at a time, opened by the levels you earn.',
  releases: [
    { when: 'AT LAUNCH',   name: 'Launch 1',   rot: [1.2, 1],
      items: ['Plan your day with Mylo', 'Tick tasks, close the day', 'Private rooms with your people', 'Levels, streaks and badges', 'A Sunday chest with outfits'] },
    { when: 'SOON AFTER',  name: 'Update 1.1', rot: [-1, -1],
      items: ['Chess and Chance in your room', 'Challenges and dares', 'Your week, read by Mylo'] },
    { when: 'LATER',       name: 'Update 1.2', rot: [0.8, 0.6],
      items: ['Eggs and pets', "Decorate Mylo's place"] },
    { when: 'LATER',       name: 'Update 1.3', rot: [-1.2, -0.8],
      items: ['A feed for your friends', 'More games'] },
    { when: 'NEXT SEASON', name: 'Update 2.0', rot: [1, 1],
      items: ["Mylo's house and visits", 'Photo studio with friends', 'Gift a card'] },
    { when: 'AFTER THAT',  name: 'Update 2.1', rot: [-0.8, -0.7],
      items: ['Focus lock', 'Widgets', 'Rare looks'] }
  ],
  note: {
    title: 'Some things are always open',
    body: 'Messages, inviting friends, settings and safety tools never sit behind a level.'
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   Text pages, word for word from Figma: "Web · Questions" (1131:136496),
   "Web · Safety" (1107:91388), "Web · Privacy" (1107:91594) and
   "Web · Help" (1107:91836). Each is a header, a column of sections and a
   dark contact card. A section may carry bullets after its first line.
   ────────────────────────────────────────────────────────────────────────── */
export type TextSection = { title: string; body?: string; bullets?: string[] };
export type TextPageCopy = {
  eyebrow: string; title: string; lead: string;
  sections: TextSection[];
  contact: { title: string; body: string; cta: string; href: string };
};

const MESSAGE_US = 'mailto:hello@staymylo.com';

export const QUESTIONS_PAGE: TextPageCopy = {
  eyebrow: 'QUESTIONS',
  title: 'Good questions.',
  lead: 'Short answers to what people ask most. Still unsure? Message us and a real person answers.',
  sections: [
    { title: 'When does Mylo launch?', body: 'Testers get it first, then everyone on the waitlist in the order they joined. Mylo opens to everyone on 3 December.' },
    { title: 'Is it free?', body: 'Yes. Mylo is free to use, and the daily loop will always be free.' },
    { title: 'What is a room?', body: 'A private space for a few people you trust, like a partner, your crew or study friends. You share goals, tick tasks, chat and cheer each other on.' },
    { title: 'Can I use Mylo on my own?', body: 'Yes. Mylo works for one person too, and you can add your people later without starting over.' },
    { title: 'Who can see my goals?', body: 'Only the rooms you share a goal with. Private goals never leave your account.' },
    { title: 'What happens if I miss a day?', body: 'Nothing bad. One miss uses a streak freeze if you have one, and Mylo helps you start again. Never miss twice.' },
    { title: 'Why are some features locked?', body: 'New things open as you level up, so Mylo never feels like too much at once.' },
    { title: 'Why can’t I get Gold chests straight away?', body: 'Gold chests are for people who keep showing up. Weeks 1 and 2 give a Wood chest, week 3 a Silver chest, and from week 4 a perfect week earns Gold.' },
    { title: 'Can I buy keys or cards?', body: 'No. Keys come from showing up 5 days in a week or from levelling up. Nothing in Mylo is for sale.' },
    { title: 'Can I have lots of pets?', body: 'Your pet house holds 6, and one walks with your Mylo at a time. Eggs hatch after 5 active days.' },
    { title: 'Can I give a card to a friend?', body: 'Yes, one card a week, to a friend who has been in a room with you for at least 7 days.' },
    { title: 'Is my data safe?', body: 'Rooms are private, staff cannot read your messages, and we never sell your data. Read the Privacy page for the details.' }
  ],
  contact: { title: 'Still stuck?', body: 'Message us, or report a bug from Settings, Help and feedback in the app.', cta: 'Message us', href: MESSAGE_US }
};

export const SAFETY_PAGE: TextPageCopy = {
  eyebrow: 'SAFETY',
  title: 'Built for small rooms you trust.',
  lead: 'Mylo is for people you already know. Here is how we keep rooms private and safe, and what to do when something feels wrong.',
  sections: [
    { title: 'Rooms are private',
      body: 'Rooms are invite only. Nobody can find your room unless you share the link or the code, and the room admin approves every join request.',
      bullets: ['Tasks you keep to yourself are never shown to a room.', 'Goals you share only show in the rooms you pick.'] },
    { title: 'You decide about photos', body: 'Nothing with your face goes to a room without your say. View once photos cannot be saved, and the sender is told if someone takes a screenshot.' },
    { title: '13 and up', body: 'You must be 13 or older to use Mylo. We ask your age when you sign up. If you are under 13, we stop there and keep nothing you typed.' },
    { title: 'Report, block, leave',
      body: 'Long press any message or open any profile to report or block someone. Reports are anonymous and blocked people are never told. You can leave any room in two taps.',
      bullets: ['Real people review every report.', 'We can warn, remove content or suspend accounts.'] },
    { title: 'What verified means', body: 'A verified badge means we checked a phone number and a selfie. It does not mean we know the person in real life. Only verified people can host public rooms.' },
    { title: 'If someone is in danger', body: 'Mylo is not an emergency service. If you or someone else is in danger, contact your local emergency services first, then tell us.' }
  ],
  contact: { title: 'Something wrong?', body: 'Report it in the app, or email safety@staymylo.com.', cta: 'Email us', href: 'mailto:safety@staymylo.com' }
};

export const PRIVACY_PAGE: TextPageCopy = {
  eyebrow: 'PRIVACY',
  title: 'Your data, in plain words.',
  lead: 'What Mylo collects, why we need it, and what you can do about it. Last updated 31 October 2026.',
  sections: [
    { title: 'Who we are', body: 'Mylo is made by Wintech Studio. When this page says we, it means the Mylo team at Wintech Studio.' },
    { title: 'What we collect', body: 'Only what Mylo needs to work.',
      bullets: ['Account: email, name, username, photo and age.',
                'What you add: tasks, goals, journal entries, messages, voice notes, photos and reactions.',
                'Usage: device type, app version and crash reports.',
                'Waitlist: your email, the country your connection comes from, and who referred you.'] },
    { title: 'What we use it for', body: 'To run Mylo for you and your rooms.',
      bullets: ['Show your room only what you choose to share.', 'Send the nudges you turned on.', 'Keep Mylo safe and fix what breaks.'] },
    { title: 'What we never do', body: 'We do not sell your data. We do not show ads based on it. Staff cannot read private room messages; they only see messages that someone reported.' },
    { title: 'Mylo AI', body: 'When you talk to Mylo AI, your message is sent to our AI provider only to write the reply. Drafts are never saved until you tap Add.' },
    { title: 'Who sees what', body: 'Room members see what you share in that room. Friends see your profile overview and the goals you share with them. Private goals never leave your account.' },
    { title: 'Where it lives and how long', body: 'Your data is stored with our cloud database provider and encrypted in transit and at rest. We keep it until you delete your account. After a 30 day grace period, everything is removed.' },
    { title: 'Your choices', body: 'You are in charge of your data.',
      bullets: ['Download a copy in Settings, Your data.', 'Delete your account in Settings at any time.', 'Turn notifications on or off whenever you like.'] },
    { title: 'Children', body: 'Mylo is for people aged 13 and up. We do not knowingly keep data from anyone younger.' },
    { title: 'Changes to this page', body: 'If we change how we use your data, we will update this page and tell you in the app first.' }
  ],
  contact: { title: 'Questions about your data?', body: 'Email privacy@staymylo.com and a real person will answer.', cta: 'Email us', href: 'mailto:privacy@staymylo.com' }
};

/* No Figma frame: the Privacy layout with the previous site's Terms
   (archive/website-v1/terms.html), reworded only to drop its em dash. */
export const TERMS_PAGE: TextPageCopy = {
  eyebrow: 'TERMS',
  title: 'The rules, in plain words.',
  lead: 'What you agree to when you use Mylo. Last updated September 2026.',
  sections: [
    { title: 'Who we are', body: 'Mylo is made by Wintech Studio in Lagos, Nigeria.' },
    { title: 'The waitlist', body: "Joining the waitlist gets you an invite when your batch opens. Invites go out oldest-first, adjusted by referrals. A place on the list isn't a guarantee of a date." },
    { title: 'Your account', body: "You need to be 13 or older. One account per person. You're responsible for what you post in a room, and room admins can remove you from theirs. Don't use Mylo to harass people, post things you don't have the right to, or attack the service." },
    { title: 'Plans and credits', body: "Free is free. Pro and Pod are monthly, in naira. Cancel any time and you keep the plan until the end of the period you paid for. AI credits are consumed per Mylo AI call and aren't refundable once used. $MYL is an in-app points balance with no cash value and can't be bought, sold or transferred outside the app." },
    { title: 'The reward pool', body: "Season rewards are funded from a published share of Mylo's revenue and paid out per the rules published in-app before each round. Rankings are based on verified activity; we may exclude accounts we believe are automated, duplicated or gaming the system, and our decision on that is final. Pool size and dates may change until a round is announced." },
    { title: 'Availability', body: "Mylo is early. Things will change, break, and get fixed. We'll be honest about it. We can suspend or end accounts that break these terms, and we'll give notice if we ever wind the service down." }
  ],
  contact: { title: 'Questions about these terms?', body: 'Email hello@staymylo.com and a real person will answer.', cta: 'Email us', href: MESSAGE_US }
};

export const HELP_PAGE: TextPageCopy & {
  search: string; popular: string; noMatch: string;
  topics: { icon: string; title: string; body: string; href?: string }[];
} = {
  eyebrow: 'HELP CENTRE',
  title: 'How can we help?',
  lead: 'Quick answers to the things people ask most. Still stuck? Message us and a real person answers.',
  search: 'Search help',
  topics: [
    { icon: 'topic-start',   title: 'Getting started',     body: 'Sign up, your Mylo, your first goal' },
    { icon: 'topic-rooms',   title: 'Rooms and friends',   body: 'Invite people, join, settings' },
    { icon: 'topic-goals',   title: 'Goals and Today',     body: 'Tasks, repeats, the two minute version' },
    { icon: 'topic-levels',  title: 'Levels and rewards',  body: 'XP, keys, chests, cards, pets' },
    { icon: 'topic-account', title: 'Account and privacy', body: 'Email, password, your data' },
    { icon: 'topic-bugs',    title: 'Testers and bugs',    body: 'Report a bug, what is new', href: '/report-a-bug' }
  ],
  popular: 'Popular questions',
  // No frame for an empty search; this is the second half of the lead.
  noMatch: 'Still stuck? Message us and a real person answers.',
  sections: [
    { title: 'How do I invite someone to my room?', body: 'Open the room, tap the room name, then Invite. Share the link or the 6 letter code.' },
    { title: 'Why is a feature locked?', body: 'Some features open as you level up so Mylo never feels like too much. Tap a locked app to see how much XP you need.' },
    { title: 'How do keys and chests work?', body: 'Show up 5 days in a week to earn a key, or level up. On Sunday, after your review, one key opens one chest.' },
    { title: 'Can I use Mylo on my computer?', body: 'Yes. Mylo works in the browser on your computer and your phone, and your account stays in sync.' },
    { title: 'How do I change my email or password?', body: 'Go to Settings, Account. You can change your email, password and phone number there.' },
    { title: 'How do I delete my account?', body: 'Settings, Delete account. You have 30 days to change your mind, then everything is removed.' }
  ],
  contact: { title: 'Still stuck?', body: 'Message us, or report a bug from Settings, Help and feedback in the app.', cta: 'Message us', href: MESSAGE_US }
};

/* Figma "Web · Playground" (1134:1037) and its phone twin (1131:133452). */
export const PLAYGROUND_PAGE = {
  eyebrow: 'PLAYGROUND',
  title: 'Go on, pull things around.',
  leadWide: 'Everything on this board is alive. Drag it, throw it, tap it. Crack an egg, open the chest, dress Mylo up. Nothing here can break.',
  leadPhone: 'Everything on this board is alive. Drag it, throw it, tap it. Crack an egg, open the chest, dress Mylo up.',
  tools: ['Drag anything', 'Tap to play', 'Shake to mix'],
  tips: { crack: 'Tap to crack', drop: 'Drop anywhere', key: 'Drag the key onto the chest', outfit: 'Drop an outfit on Mylo' },
  tryOn: 'Try on',
  outfits: [
    { key: 'winter', name: 'Winter Cozy',  rarity: '#8E95A6', mini: 'pgp-mini-winter', big: '/figma/mylo-winter.svg' },
    { key: 'studio', name: 'Studio Vibes', rarity: '#3E7BFA', mini: 'pgp-mini-studio', big: '/figma/pgp-mylo-studio.svg' },
    { key: 'party',  name: 'Party Host',   rarity: '#7A5CD9', mini: 'pgp-mini-party',  big: '/figma/mylo-party.svg' }
  ],
  howTitle: 'How it plays',
  how: [
    { n: '01', title: 'Crack the egg',  body: 'Tap three times. It wobbles, cracks, then a buddy pops out.' },
    { n: '02', title: 'Open the chest', body: 'Drag the key onto the chest, or tap it. A card flies out.' },
    { n: '03', title: 'Try on clothes', body: 'Drag an outfit onto Mylo, or tap one to put it on.' },
    { n: '04', title: 'Throw anything', body: 'Throw a card and it drifts back slowly. Shake to mix the board.' }
  ]
};

/* /report-a-bug. The words come from the previous site's Testers page and
   Figma's "L6 · Report a bug (testers)"
   (368:72964, dark 454:109208); only what happens after sending is new. */
export const BUG_PAGE = {
  eyebrow: 'TESTERS',
  title: 'Found a bug?',
  lead: 'Tell us what broke, where, and what you expected instead. No screenshots needed, plain words are fine.',
  amount: '100 $MYL',
  pay: 'for every bug report we can confirm',
  duplicates: 'Duplicates don\u2019t pay, but they still help: they tell us how often it bites.',
  whereLabel: 'Where did it happen?',
  areas: ['Today', 'Goals', 'Calendar', 'Chat', 'Rooms', 'Apps & games', 'Mylo AI', 'Stories', 'Signing in', 'Something else'],
  whatLabel: 'What happened?',
  placeholder: 'I tapped the tick on a shared goal and it went back to undone when I reopened the room.',
  userLabel: 'Your Mylo username',
  userPlaceholder: '@yourname',
  fine: 'We only use your username to pay you. Bug reports are never shown publicly. Device info is attached for you.',
  cta: 'Send report',
  sending: 'Sending',
  pickArea: 'Pick where it happened.',
  tooShort: 'Tell us a bit more about what happened.',
  failed: 'That did not go through. Try again.',
  slowDown: 'That is a lot of reports. Try again shortly.',
  sentTitle: 'Got it. Thank you.',
  sentBody: 'Your reference is',
  again: 'Report another'
};
