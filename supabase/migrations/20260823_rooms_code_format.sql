-- Fix: gen_room_code is 10 chars but rooms_code_format still required exactly 6
-- Run in Supabase SQL Editor, then retest create/join.

alter table public.rooms drop constraint if exists rooms_code_format;
alter table public.rooms
  add constraint rooms_code_format check (code ~ '^[A-Z0-9]{6,12}$');
