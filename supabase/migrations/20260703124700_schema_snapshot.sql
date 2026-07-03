-- TradeLog / SMC Trading Journal
-- Supabase schema snapshot migration
-- Source project: PROD zmtpgnnqtkkdsrswhrzk (SMC Trading Journal)
-- Captured 2026-07-03, verified column-by-column against live information_schema by Claude.
--
-- Purpose:
--   Reconstruct the current public schema for a fresh Supabase project.
--   This migration intentionally does NOT include user/trade data.
--
-- Notes:
--   - Requires Supabase auth schema to exist.
--   - RLS policies mirror the current PROD project at capture time.
--   - storage.buckets returned no rows at capture time; Cloudflare R2 buckets are not part of this SQL migration.
--   - Event trigger metadata could not be safely extracted through the connector; function public.rls_auto_enable() is included, but no event trigger is created here.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_flags (
  user_id uuid not null references auth.users(id) on delete cascade,
  is_admin boolean default false,
  constraint admin_flags_pkey primary key (user_id)
);

create table if not exists public.user_profiles (
  user_id uuid not null references auth.users(id),
  display_name text not null,
  first_name text,
  last_name text,
  created_at timestamp with time zone default now(),
  constraint user_profiles_pkey primary key (user_id)
);

create table if not exists public.user_settings (
  user_id uuid not null references auth.users(id),
  settings jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default now(),
  constraint user_settings_pkey primary key (user_id)
);

create table if not exists public.trades (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  created_at timestamp with time zone default now(),
  date text,
  time text,
  strategy text,
  symbol text,
  direction text,
  entry numeric,
  sl numeric,
  tp numeric,
  outcome text,
  result numeric,
  grade text,
  checklist_pct integer,
  notes text,
  chart_link text,
  image_url text,
  custom_data jsonb,
  risk_amount numeric,
  risk_currency text,
  emotion text,
  constraint trades_pkey primary key (id)
);

create table if not exists public.checklists (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  strategy_key text not null,
  name text not null,
  phases jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint checklists_pkey primary key (id)
);

create table if not exists public.deletion_requests (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  email text,
  requested_at timestamp with time zone default now(),
  status text default 'pending'::text,
  admin_note text,
  constraint deletion_requests_pkey primary key (id)
);

create table if not exists public.login_log (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  email text,
  logged_in_at timestamp with time zone default now(),
  user_agent text,
  ip_hint text,
  constraint login_log_pkey primary key (id)
);

create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  published_at timestamp with time zone,
  is_published boolean default false,
  constraint messages_pkey primary key (id)
);

create table if not exists public.inbox_threads (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  status text default 'open'::text,
  thread_type text default 'support'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint inbox_threads_pkey primary key (id),
  constraint inbox_threads_status_check check (status = any (array['open'::text, 'closed'::text])),
  constraint inbox_threads_thread_type_check check (thread_type = any (array['support'::text, 'direct'::text]))
);

create table if not exists public.inbox_messages (
  id uuid not null default gen_random_uuid(),
  thread_id uuid not null references public.inbox_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamp with time zone default now(),
  read_at timestamp with time zone,
  constraint inbox_messages_pkey primary key (id)
);

create table if not exists public.message_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  read_at timestamp with time zone default now(),
  constraint message_reads_pkey primary key (user_id, message_id)
);

alter table public.admin_flags enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.trades enable row level security;
alter table public.checklists enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.login_log enable row level security;
alter table public.messages enable row level security;
alter table public.inbox_threads enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.message_reads enable row level security;

create or replace function public.admin_set_user_setting(target_user_id uuid, setting_key text, setting_value boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from user_settings
    where user_id = auth.uid()
      and settings->>'is_admin' = 'true'
  ) then
    raise exception 'Not authorized';
  end if;

  insert into user_settings (user_id, settings, updated_at)
  values (target_user_id, jsonb_build_object(setting_key, setting_value), now())
  on conflict (user_id) do update
  set settings = user_settings.settings || jsonb_build_object(setting_key, setting_value),
      updated_at = now();
end;
$function$;

create or replace function public.delete_user_completely(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from admin_flags
    where user_id = auth.uid() and is_admin = true
  ) then raise exception 'Not authorized'; end if;

  delete from checklists where user_id = target_user_id;
  delete from trades where user_id = target_user_id;
  delete from user_profiles where user_id = target_user_id;
  delete from user_settings where user_id = target_user_id;
  delete from login_log where user_id = target_user_id;
  delete from deletion_requests where user_id = target_user_id;
  delete from admin_flags where user_id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$function$;

create or replace function public.get_admin_users()
returns table(user_id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, confirmed_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.admin_flags
    where admin_flags.user_id = auth.uid()
      and admin_flags.is_admin = true
  ) then
    raise exception 'Access denied';
  end if;

  return query
  select u.id::uuid as user_id, u.email::text, u.created_at, u.last_sign_in_at, u.confirmed_at
  from auth.users u;
end;
$function$;

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$function$;

-- Policies: drop first so the migration is re-runnable in dev/test.
drop policy if exists "Admins can read all" on public.admin_flags;
create policy "Admins can read all" on public.admin_flags for select using (true);

drop policy if exists "Users manage own profile" on public.user_profiles;
create policy "Users manage own profile" on public.user_profiles for all using (auth.uid() = user_id);

drop policy if exists "Admins view all settings" on public.user_settings;
create policy "Admins view all settings" on public.user_settings for select using (auth.uid() = user_id or exists (select 1 from public.admin_flags af where af.user_id = auth.uid() and af.is_admin = true));

drop policy if exists "Public insert roadmap admin row" on public.user_settings;
create policy "Public insert roadmap admin row" on public.user_settings for insert with check (user_id = '9ed649b7-8ad8-4ba7-bc89-ec0efa566b9d'::uuid);

drop policy if exists "Public read roadmap admin row" on public.user_settings;
create policy "Public read roadmap admin row" on public.user_settings for select using (user_id = '9ed649b7-8ad8-4ba7-bc89-ec0efa566b9d'::uuid);

drop policy if exists "Public update roadmap admin row" on public.user_settings;
create policy "Public update roadmap admin row" on public.user_settings for update using (user_id = '9ed649b7-8ad8-4ba7-bc89-ec0efa566b9d'::uuid) with check (user_id = '9ed649b7-8ad8-4ba7-bc89-ec0efa566b9d'::uuid);

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings" on public.user_settings for all using (auth.uid() = user_id);

drop policy if exists "Users see own trades" on public.trades;
create policy "Users see own trades" on public.trades for all using (auth.uid() = user_id or exists (select 1 from public.user_settings where user_settings.user_id = auth.uid() and (user_settings.settings ->> 'is_admin'::text) = 'true'::text));

drop policy if exists "Admins view all checklists" on public.checklists;
create policy "Admins view all checklists" on public.checklists for select using (auth.uid() = user_id or exists (select 1 from public.user_settings where user_settings.user_id = auth.uid() and (user_settings.settings ->> 'is_admin'::text) = 'true'::text));

drop policy if exists "Users manage own checklists" on public.checklists;
create policy "Users manage own checklists" on public.checklists for all using (auth.uid() = user_id);

drop policy if exists "Admins can update deletion requests" on public.deletion_requests;
create policy "Admins can update deletion requests" on public.deletion_requests for update using (exists (select 1 from public.user_settings where user_settings.user_id = auth.uid() and (user_settings.settings ->> 'is_admin'::text) = 'true'::text));

drop policy if exists "Admins can view all deletion requests" on public.deletion_requests;
create policy "Admins can view all deletion requests" on public.deletion_requests for select using (exists (select 1 from public.user_settings where user_settings.user_id = auth.uid() and (user_settings.settings ->> 'is_admin'::text) = 'true'::text));

drop policy if exists "Users can insert own request" on public.deletion_requests;
create policy "Users can insert own request" on public.deletion_requests for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view own request" on public.deletion_requests;
create policy "Users can view own request" on public.deletion_requests for select using (auth.uid() = user_id);

drop policy if exists "Admins can view all" on public.login_log;
create policy "Admins can view all" on public.login_log for select using (exists (select 1 from public.user_settings where user_settings.user_id = auth.uid() and (user_settings.settings ->> 'is_admin'::text) = 'true'::text));

drop policy if exists "Users can insert own log" on public.login_log;
create policy "Users can insert own log" on public.login_log for insert with check (auth.uid() = user_id);

drop policy if exists "Admin manage messages" on public.messages;
create policy "Admin manage messages" on public.messages for all using (exists (select 1 from public.admin_flags where admin_flags.user_id = auth.uid() and admin_flags.is_admin = true));

drop policy if exists "Public read published messages" on public.messages;
create policy "Public read published messages" on public.messages for select using (is_published = true);

drop policy if exists "Admin see all threads" on public.inbox_threads;
create policy "Admin see all threads" on public.inbox_threads for all using (exists (select 1 from public.admin_flags where admin_flags.user_id = auth.uid() and admin_flags.is_admin = true));

drop policy if exists "Users create own threads" on public.inbox_threads;
create policy "Users create own threads" on public.inbox_threads for insert with check (user_id = auth.uid());

drop policy if exists "Users see own threads" on public.inbox_threads;
create policy "Users see own threads" on public.inbox_threads for select using (user_id = auth.uid());

drop policy if exists "Admin manage all inbox messages" on public.inbox_messages;
create policy "Admin manage all inbox messages" on public.inbox_messages for all using (exists (select 1 from public.admin_flags where admin_flags.user_id = auth.uid() and admin_flags.is_admin = true));

drop policy if exists "Users mark messages as read in own threads" on public.inbox_messages;
create policy "Users mark messages as read in own threads" on public.inbox_messages for update using (exists (select 1 from public.inbox_threads where inbox_threads.id = inbox_messages.thread_id and inbox_threads.user_id = auth.uid())) with check (exists (select 1 from public.inbox_threads where inbox_threads.id = inbox_messages.thread_id and inbox_threads.user_id = auth.uid()));

drop policy if exists "Users see messages in own threads" on public.inbox_messages;
create policy "Users see messages in own threads" on public.inbox_messages for select using (exists (select 1 from public.inbox_threads where inbox_threads.id = inbox_messages.thread_id and inbox_threads.user_id = auth.uid()) or sender_id = auth.uid());

drop policy if exists "Users send messages in own threads" on public.inbox_messages;
create policy "Users send messages in own threads" on public.inbox_messages for insert with check (sender_id = auth.uid() and exists (select 1 from public.inbox_threads where inbox_threads.id = inbox_messages.thread_id and inbox_threads.user_id = auth.uid()));

drop policy if exists "Users manage own reads" on public.message_reads;
create policy "Users manage own reads" on public.message_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant all on table public.admin_flags, public.checklists, public.deletion_requests, public.inbox_messages, public.inbox_threads, public.login_log, public.message_reads, public.messages, public.trades, public.user_profiles, public.user_settings to anon, authenticated, service_role;
grant execute on function public.admin_set_user_setting(uuid, text, boolean) to anon, authenticated, service_role;
grant execute on function public.delete_user_completely(uuid) to anon, authenticated, service_role;
grant execute on function public.get_admin_users() to anon, authenticated, service_role;
