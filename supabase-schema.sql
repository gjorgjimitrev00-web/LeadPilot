create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user',
  plan_id text not null default 'free',
  subscription_status text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  searches_used integer not null default 0,
  usage_period text not null,
  daily_searches_used integer not null default 0,
  daily_usage_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null and stripe_customer_id <> '';

alter table public.profiles
  add column if not exists role text not null default 'user';

create index if not exists profiles_role_idx
  on public.profiles(role);

alter table public.profiles
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists daily_searches_used integer not null default 0,
  add column if not exists daily_usage_date text;

update public.profiles
set
  trial_started_at = coalesce(trial_started_at, now()),
  trial_ends_at = coalesce(trial_ends_at, coalesce(trial_started_at, now()) + interval '3 days'),
  daily_usage_date = coalesce(daily_usage_date, to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))
where subscription_status not in ('active', 'trialing')
  and (trial_started_at is null or trial_ends_at is null or daily_usage_date is null);

create table if not exists public.subscriptions (
  subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  plan_id text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_searches (
  user_id uuid not null references auth.users(id) on delete cascade,
  search_key text not null,
  category text not null,
  location text not null,
  location_display_name text,
  radius_meters integer not null,
  seen_lead_ids jsonb not null default '[]'::jsonb,
  last_leads jsonb not null default '[]'::jsonb,
  last_result_count integer not null default 0,
  last_skipped_count integer not null default 0,
  reset_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, search_key)
);

alter table public.saved_searches
  add column if not exists last_leads jsonb not null default '[]'::jsonb;

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.saved_searches enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own subscriptions" on public.subscriptions;
create policy "Users can read own subscriptions"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own saved searches" on public.saved_searches;
create policy "Users can read own saved searches"
  on public.saved_searches
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own saved searches" on public.saved_searches;
create policy "Users can insert own saved searches"
  on public.saved_searches
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own saved searches" on public.saved_searches;
create policy "Users can update own saved searches"
  on public.saved_searches
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own saved searches" on public.saved_searches;
create policy "Users can delete own saved searches"
  on public.saved_searches
  for delete
  using (auth.uid() = user_id);

-- The app server uses SUPABASE_SERVICE_ROLE_KEY for inserts/updates.
-- Keep that key only on the server. Never expose it in browser code.
