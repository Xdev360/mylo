-- Allow Chance / board games to post on messages.
-- Previously messages_kind_check only allowed:
--   text, sticker, cheer, poll, mood, task_card, spin
-- The app can also use kind = 'chance' for rock-paper-scissors and board games.
-- (Client currently saves games as kind = 'text' with payload.game, which already works.)

alter table public.messages drop constraint if exists messages_kind_check;

alter table public.messages
  add constraint messages_kind_check
  check (kind in (
    'text',
    'sticker',
    'cheer',
    'poll',
    'mood',
    'task_card',
    'spin',
    'chance',
    'note'
  ));
