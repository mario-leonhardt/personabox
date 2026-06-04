-- Run this in Supabase SQL Editor to add new columns
-- (safe to run even if table already exists)

alter table personas add column if not exists email text default '';

-- If starting fresh, use this full table definition:
-- create table if not exists personas (
--   id text primary key,
--   firstname text default '',
--   lastname text default '',
--   name text default '',
--   gender text default '',
--   email text default '',
--   title text default '',
--   company text default '',
--   industry text default '',
--   location text default '',
--   birthday text default '',
--   language text default 'formal',
--   goal text default '',
--   "privateGoal" text default '',
--   product text default '',
--   keywords jsonb default '[]',
--   "contentItems" jsonb default '[]',
--   analysis text default '',
--   created_at timestamp with time zone default now()
-- );
-- alter table personas enable row level security;
-- create policy "Public access" on personas for all using (true) with check (true);
