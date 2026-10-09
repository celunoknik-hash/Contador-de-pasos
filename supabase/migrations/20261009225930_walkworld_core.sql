-- WalkWorld cloud foundation. No client-controlled verified steps or rewards.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Explorador' check (char_length(btrim(display_name)) between 1 and 40),
  avatar_key text not null default 'walker' check (avatar_key in ('walker', 'forest', 'ocean', 'mountain')),
  created_at timestamptz not null default now()
);
create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal integer not null default 5000 check (daily_goal between 500 and 50000),
  stride_meters numeric(4,2) not null default 0.70 check (stride_meters between 0.30 and 1.50),
  weight_kg numeric(5,2) not null default 70 check (weight_kg between 20 and 300),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark'))
);
create table public.devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  primary key (user_id, device_id)
);
-- Immutable submissions: future authenticated server endpoint validates and inserts.
-- Retries must use the same client_event_id. Unvalidated records earn nothing.
create table public.step_submissions (
  user_id uuid not null,
  device_id uuid not null,
  client_event_id uuid not null,
  local_date date not null,
  timezone text not null check (char_length(timezone) between 1 and 100),
  source text not null check (source in ('sensor', 'health-connect')),
  steps integer not null check (steps between 0 and 250000),
  revision bigint not null check (revision > 0),
  partial boolean not null,
  anomalies integer not null default 0 check (anomalies >= 0),
  received_at timestamptz not null default now(),
  primary key (user_id, device_id, client_event_id),
  unique (user_id, device_id, local_date, revision),
  foreign key (user_id, device_id) references public.devices(user_id, device_id) on delete cascade
);
-- One canonical daily source/device: never sum overlapping snapshots.
create table public.daily_steps (
  user_id uuid not null,
  local_date date not null,
  device_id uuid not null,
  timezone text not null check (char_length(timezone) between 1 and 100),
  source text not null check (source in ('sensor', 'health-connect')),
  steps integer not null check (steps between 0 and 250000),
  goal integer not null check (goal between 500 and 50000),
  partial boolean not null,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date),
  foreign key (user_id, device_id) references public.devices(user_id, device_id) on delete cascade
);
create index daily_steps_device_idx on public.daily_steps(user_id, device_id);
create table public.coin_ledger (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 150),
  delta integer not null check (delta <> 0),
  reason text not null check (char_length(reason) between 1 and 100),
  local_date date,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, idempotency_key)
);
create index coin_ledger_history_idx on public.coin_ledger(user_id, created_at desc);

-- Explicit grants plus RLS: even the publicly distributed publishable key has no guest access.
do $$
declare tbl text;
begin
  foreach tbl in array array['profiles','preferences','devices','step_submissions','daily_steps','coin_ledger'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from public, anon, authenticated', tbl);
    execute format('grant select on table public.%I to authenticated', tbl);
    execute format('grant all on table public.%I to service_role', tbl);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)', tbl);
  end loop;
  foreach tbl in array array['profiles','preferences'] loop
    execute format('grant insert, update on table public.%I to authenticated', tbl);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', tbl);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', tbl);
  end loop;
end $$;
-- Device registration and all activity/reward mutations remain server-only until validated APIs exist.
