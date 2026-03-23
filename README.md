# FQH Season Stats App

Vite + React + Supabase app for FQH season tracking.

## What changed in this build
- Season selector is a text field. Type something like `21st` and press Enter or click **Load Season**.
- The typed season controls which records load from Supabase via `season_key`.
- Year is a text field used only for PNG output.
- GP is one combined games-played column.
- Points are combined across player and goalie appearances.
- PNG export now renders from dedicated off-screen export layouts, so you do not get clipped tables or visible scrollbars.
- Game recap export uses **Most Goals**, **Most Assists**, **Most Points**, and a manually selected **MVP**.
- A placeholder `public/logo.png` is included so the app does not 404 if you forget to swap in your real logo.
- Vercel is set up to use pnpm.

## Logo
Replace the included placeholder logo with your square logo at:

`public/logo.png`

## Environment variables
Add these in Vercel and in your local `.env`:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

## Database setup
If this is your first time, run this in the Supabase SQL editor:

```sql
create extension if not exists pgcrypto;

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  season_key text not null default '21st',
  game_date date not null,
  notes text default '',
  mvp_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists game_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  team text not null check (team in ('Red', 'Blue')),
  role text not null check (role in ('player', 'goalie')),
  goals integer not null default 0,
  assists integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_games_season_key on games(season_key);
create index if not exists idx_game_entries_game_id on game_entries(game_id);
create index if not exists idx_game_entries_name on game_entries(name);
```

## Existing database migration
If you are reusing your current Supabase database, run this instead:

```sql
alter table games add column if not exists season_key text not null default '21st';
alter table games add column if not exists mvp_name text not null default '';
create index if not exists idx_games_season_key on games(season_key);
update games set season_key = '21st' where season_key is null or season_key = '';
update games set mvp_name = '' where mvp_name is null;
```

You can keep using the same database.

## Row level security
Run this if you want the app to work immediately with the publishable key:

```sql
alter table games enable row level security;
alter table game_entries enable row level security;

create policy "public read games" on games for select to anon using (true);
create policy "public insert games" on games for insert to anon with check (true);
create policy "public update games" on games for update to anon using (true);
create policy "public delete games" on games for delete to anon using (true);

create policy "public read game_entries" on game_entries for select to anon using (true);
create policy "public insert game_entries" on game_entries for insert to anon with check (true);
create policy "public update game_entries" on game_entries for update to anon using (true);
create policy "public delete game_entries" on game_entries for delete to anon using (true);
```

## Local dev
```bash
pnpm install
pnpm dev
```

## Vercel
This project includes `vercel.json`. Connect the repo, add env vars, and deploy.
