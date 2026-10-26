-- PingMe database schema -- the single source of truth for the Supabase project.
--
-- This file is declarative and rerunnable. Running it against an empty database
-- builds the whole schema; running it against a database that is already set up
-- applies only what has drifted and leaves existing rows alone. There is no
-- migration history to keep in order: edit this file to describe the database
-- you want, then run it again.
--
--   psql "$DATABASE_URL" -f supabase/schema.sql
--
-- or paste it into the Supabase SQL editor, which wraps it in one transaction so
-- a failure part-way through rolls the whole run back.
--
-- How each kind of object is reconciled:
--   tables, columns, indexes  added when missing, never dropped or retyped
--   check constraints         dropped and recreated, so edits here take effect
--   keys and foreign keys     added when missing by name (see KEYS below)
--   functions and policies    dropped and recreated in full every run
--   grants                    revoked and reissued every run
--
-- Changing a column's type, default or nullability, or changing a key or foreign
-- key, is the one case this file cannot do on its own: `add column if not exists`
-- and the key loop both skip an object that already exists. Add an explicit
-- `alter table ... alter column ...` (or drop the old constraint) in the DRIFT
-- section below, and delete it once every database has run it.

create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------------------
-- TABLES AND COLUMNS
--
-- Tables are created empty and every column is declared once here, so this
-- section doubles as the column reference and as the upgrade path for a database
-- that predates a column. A new column on a table that already holds rows needs
-- a default if it is `not null`.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles ();
alter table public.profiles
  add column if not exists id uuid not null,
  add column if not exists username text not null,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.friendships ();
alter table public.friendships
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists requester_id uuid not null,
  add column if not exists recipient_id uuid not null,
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.blocks ();
alter table public.blocks
  add column if not exists blocker_id uuid not null,
  add column if not exists blocked_id uuid not null,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.reports ();
alter table public.reports
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists reporter_id uuid not null,
  add column if not exists reported_id uuid not null,
  add column if not exists reason text not null,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.pings ();
alter table public.pings
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists creator_id uuid not null,
  add column if not exists activity text not null,
  add column if not exists description text,
  add column if not exists location_name text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists starts_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz not null,
  add column if not exists visibility text not null default 'friends',
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.ping_acceptances ();
alter table public.ping_acceptances
  add column if not exists ping_id uuid not null,
  add column if not exists user_id uuid not null,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.notification_preferences ();
alter table public.notification_preferences
  add column if not exists user_id uuid not null,
  add column if not exists friend_id uuid,
  add column if not exists activity text,
  add column if not exists enabled boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.push_devices ();
alter table public.push_devices
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists user_id uuid not null,
  add column if not exists token text not null,
  add column if not exists platform text not null,
  add column if not exists created_at timestamptz not null default now();


-- ---------------------------------------------------------------------------
-- DRIFT
--
-- One-off repairs for databases created by an older version of this file, and
-- data that has to be fixed before the constraints below can be re-added. Each
-- statement is written to be safe on a database that never needed it, and can be
-- deleted once no live database predates it.
-- ---------------------------------------------------------------------------

-- The activity list once offered 'Coffee' and a generic 'Sports'. Pings on a
-- retired activity are remapped; a muted preference for an activity that no
-- longer exists has nothing left to mute, so it is dropped.
update public.pings
set activity = 'Other'
where activity in ('Coffee', 'Sports');

delete from public.notification_preferences
where activity in ('Coffee', 'Sports');

-- Multi-column checks written without a name in the first migration landed as
-- pings_check, pings_check1 and so on. They are replaced by the named checks
-- below, so the generated names have to go.
alter table public.friendships drop constraint if exists friendships_check;
alter table public.blocks drop constraint if exists blocks_check;
alter table public.pings drop constraint if exists pings_check;
alter table public.pings drop constraint if exists pings_check1;
alter table public.notification_preferences drop constraint if exists notification_preferences_check;


-- ---------------------------------------------------------------------------
-- KEYS AND FOREIGN KEYS
--
-- Added only when a constraint of that name is missing: rebuilding a key on
-- every run would relock and revalidate every table for nothing. The names match
-- what Postgres generates for an inline constraint, so a database built by the
-- original migration already satisfies this section. To change one of these,
-- drop it by name in DRIFT above and let this section re-add it.
-- ---------------------------------------------------------------------------

do $keys$
declare
  r record;
begin
  for r in
    select * from (values
      ('profiles', 'profiles_pkey', 'primary key (id)'),
      ('profiles', 'profiles_username_key', 'unique (username)'),
      ('profiles', 'profiles_id_fkey',
        'foreign key (id) references auth.users(id) on delete cascade'),

      ('friendships', 'friendships_pkey', 'primary key (id)'),
      ('friendships', 'friendships_requester_id_recipient_id_key',
        'unique (requester_id, recipient_id)'),
      ('friendships', 'friendships_requester_id_fkey',
        'foreign key (requester_id) references public.profiles(id) on delete cascade'),
      ('friendships', 'friendships_recipient_id_fkey',
        'foreign key (recipient_id) references public.profiles(id) on delete cascade'),

      ('blocks', 'blocks_pkey', 'primary key (blocker_id, blocked_id)'),
      ('blocks', 'blocks_blocker_id_fkey',
        'foreign key (blocker_id) references public.profiles(id) on delete cascade'),
      ('blocks', 'blocks_blocked_id_fkey',
        'foreign key (blocked_id) references public.profiles(id) on delete cascade'),

      ('reports', 'reports_pkey', 'primary key (id)'),
      ('reports', 'reports_reporter_id_fkey',
        'foreign key (reporter_id) references public.profiles(id) on delete cascade'),
      ('reports', 'reports_reported_id_fkey',
        'foreign key (reported_id) references public.profiles(id) on delete cascade'),

      ('pings', 'pings_pkey', 'primary key (id)'),
      ('pings', 'pings_creator_id_fkey',
        'foreign key (creator_id) references public.profiles(id) on delete cascade'),

      ('ping_acceptances', 'ping_acceptances_pkey', 'primary key (ping_id, user_id)'),
      ('ping_acceptances', 'ping_acceptances_ping_id_fkey',
        'foreign key (ping_id) references public.pings(id) on delete cascade'),
      ('ping_acceptances', 'ping_acceptances_user_id_fkey',
        'foreign key (user_id) references public.profiles(id) on delete cascade'),

      -- Deliberately has no primary key: a row with a null friend_id or activity
      -- is the "all friends" or "all activities" default, and a primary key
      -- cannot hold nulls. `nulls not distinct` makes the unique constraint treat
      -- those defaults as one row per user instead of unlimited duplicates.
      ('notification_preferences', 'notification_preferences_user_id_friend_id_activity_key',
        'unique nulls not distinct (user_id, friend_id, activity)'),
      ('notification_preferences', 'notification_preferences_user_id_fkey',
        'foreign key (user_id) references public.profiles(id) on delete cascade'),
      ('notification_preferences', 'notification_preferences_friend_id_fkey',
        'foreign key (friend_id) references public.profiles(id) on delete cascade'),

      ('push_devices', 'push_devices_pkey', 'primary key (id)'),
      ('push_devices', 'push_devices_token_key', 'unique (token)'),
      ('push_devices', 'push_devices_user_id_fkey',
        'foreign key (user_id) references public.profiles(id) on delete cascade')
    ) as t(tbl, name, def)
  loop
    if not exists (
      select 1 from pg_constraint
      where conname::text = r.name and conrelid = format('public.%I', r.tbl)::regclass
    ) then
      execute format('alter table public.%I add constraint %I %s', r.tbl, r.name, r.def);
    end if;
  end loop;
end $keys$;


-- ---------------------------------------------------------------------------
-- CHECK CONSTRAINTS
--
-- Dropped and recreated on every run, so editing a definition here is all it
-- takes for an existing database to pick it up. Any rows that violate a new
-- definition have to be fixed in DRIFT above, or the run fails.
-- ---------------------------------------------------------------------------

do $checks$
declare
  -- The one place the allowed activities are listed. Kept in step with
  -- `activities` in lib/theme.ts.
  activity_values constant text := $list$
    'FHE', 'Food', 'Party', 'Study',
    'Gym', 'Running', 'Walk',
    'Basketball', 'Football', 'Golf', 'Pickleball', 'Soccer', 'Tennis', 'Volleyball',
    'Other'
  $list$;
  r record;
begin
  for r in
    select * from (values
      -- Lowercase, 3-24 characters: mirrored by lib/identity.ts.
      ('profiles', 'profiles_username_check', $re$check (username ~ '^[a-z0-9_]{3,24}$')$re$),
      ('profiles', 'profiles_display_name_check', 'check (char_length(display_name) <= 60)'),

      ('friendships', 'friendships_status_check',
        $def$check (status in ('pending', 'accepted'))$def$),
      ('friendships', 'friendships_distinct_users_check', 'check (requester_id <> recipient_id)'),

      ('blocks', 'blocks_distinct_users_check', 'check (blocker_id <> blocked_id)'),

      ('reports', 'reports_reason_check', 'check (char_length(reason) between 3 and 500)'),

      ('pings', 'pings_activity_check', 'check (activity in (' || activity_values || '))'),
      ('pings', 'pings_description_check', 'check (char_length(description) <= 240)'),
      ('pings', 'pings_location_name_check', 'check (char_length(location_name) <= 120)'),
      ('pings', 'pings_latitude_check', 'check (latitude between -90 and 90)'),
      ('pings', 'pings_longitude_check', 'check (longitude between -180 and 180)'),
      ('pings', 'pings_visibility_check', $def$check (visibility = 'friends')$def$),
      -- A ping always ends after it starts and never runs longer than a day.
      ('pings', 'pings_expiry_window_check',
        $def$check (expires_at > starts_at and expires_at <= starts_at + interval '24 hours')$def$),
      -- Either both coordinates or neither, so a map pin is never half set.
      ('pings', 'pings_coordinate_pair_check',
        'check ((latitude is null) = (longitude is null))'),

      -- A null activity mutes every activity.
      ('notification_preferences', 'notification_preferences_activity_check',
        'check (activity is null or activity in (' || activity_values || '))'),
      ('notification_preferences', 'notification_preferences_distinct_friend_check',
        'check (friend_id is null or friend_id <> user_id)'),

      ('push_devices', 'push_devices_platform_check',
        $def$check (platform in ('ios', 'android'))$def$)
    ) as t(tbl, name, def)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.name);
    execute format('alter table public.%I add constraint %I %s', r.tbl, r.name, r.def);
  end loop;
end $checks$;


-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

create index if not exists friendships_recipient_status_idx
  on public.friendships (recipient_id, status);
create index if not exists pings_expiry_idx on public.pings (expires_at);
create index if not exists pings_creator_idx on public.pings (creator_id, expires_at);


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- Every table is reachable from the client with the user's own JWT, so RLS is
-- what actually enforces the friend graph. Policies are dropped wholesale rather
-- than by name, so a policy renamed in this file cannot survive as a stale
-- duplicate on a database that ran the old version.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.pings enable row level security;
alter table public.ping_acceptances enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_devices enable row level security;

do $drop_policies$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'friendships', 'blocks', 'reports',
        'pings', 'ping_acceptances', 'notification_preferences', 'push_devices'
      )
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $drop_policies$;


-- ---------------------------------------------------------------------------
-- FUNCTIONS
--
-- Dropped and recreated so a changed signature or return type is not a problem.
-- The policies above are already gone at this point, which is what makes the
-- helper functions droppable. Every function is `security definer` with an empty
-- search_path, so each reference has to be schema-qualified.
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user();
drop function if exists public.is_friend(uuid, uuid);
drop function if exists public.is_blocked(uuid, uuid);
drop function if exists public.can_view_profile(uuid);
drop function if exists public.search_profiles(text, integer, integer);
drop function if exists public.get_ping_counts(uuid[]);
drop function if exists public.delete_my_account();

-- Gives every new auth user a profile, with a username derived from their
-- requested one, falling back to the local part of their email and then to their
-- user id. Runs inside the signup transaction, so it must not raise.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare desired text;
begin
  desired := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  desired := regexp_replace(desired, '[^a-z0-9_]', '', 'g');
  if length(desired)<3 then desired := 'user_' || substr(new.id::text,1,8); end if;
  if exists(select 1 from public.profiles p where p.username=left(desired,24)) then
    desired := left(desired,15) || '_' || substr(new.id::text,1,8);
  end if;
  insert into public.profiles(id,username,display_name)
  values(new.id, left(desired,24), nullif(new.raw_user_meta_data->>'display_name',''))
  on conflict(id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- The helpers below are security definer so they can see the whole friendship
-- and block graph, and each one requires the caller to be one of the two users
-- it is asked about. Without that guard a signed-in user could probe any pair.
create function public.is_friend(a uuid,b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (a=auth.uid() or b=auth.uid()) and exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=a and f.recipient_id=b) or (f.requester_id=b and f.recipient_id=a)))
$$;

create function public.is_blocked(a uuid,b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (a=auth.uid() or b=auth.uid()) and exists(select 1 from public.blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a))
$$;

-- A profile is visible to its owner, to friends, to either side of a pending
-- request, and to a ping creator for the people who accepted their ping.
create function public.can_view_profile(profile_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select profile_id=auth.uid() or (not public.is_blocked(auth.uid(),profile_id) and (public.is_friend(auth.uid(),profile_id) or exists(select 1 from public.friendships f where f.status='pending' and ((f.requester_id=auth.uid() and f.recipient_id=profile_id) or (f.recipient_id=auth.uid() and f.requester_id=profile_id))) or exists(select 1 from public.ping_acceptances a join public.pings p on p.id=a.ping_id where a.user_id=profile_id and p.creator_id=auth.uid())))
$$;

-- Username prefix search for the add-friend flow. Returns strangers only, since
-- anyone already connected or requested is handled by the friends screen, and
-- requires at least two characters so the whole user table cannot be walked.
create function public.search_profiles(search_prefix text,page_size integer default 12,page_offset integer default 0)
returns table(id uuid,username text,display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id,p.username,p.display_name from public.profiles p
  where auth.uid() is not null and char_length(trim(search_prefix)) between 2 and 24
    and left(p.username,char_length(trim(search_prefix)))=lower(trim(search_prefix)) and p.id<>auth.uid()
    and not public.is_blocked(auth.uid(),p.id)
    and not exists(select 1 from public.friendships f where (f.requester_id=auth.uid() and f.recipient_id=p.id) or (f.requester_id=p.id and f.recipient_id=auth.uid()))
  order by p.username limit greatest(1,least(coalesce(page_size,12),25)) offset greatest(0,coalesce(page_offset,0))
$$;

-- Acceptance counts for a batch of pings, restricted to the pings the caller is
-- allowed to see. Counting through the table directly would leak the
-- acceptances themselves.
create function public.get_ping_counts(ping_ids uuid[]) returns table(ping_id uuid,total bigint)
language sql stable security definer set search_path = '' as $$
  select a.ping_id,count(*) from public.ping_acceptances a
  join public.pings p on p.id=a.ping_id
  where a.ping_id=any(ping_ids) and p.expires_at>now()
    and (p.creator_id=auth.uid() or (public.is_friend(auth.uid(),p.creator_id) and not public.is_blocked(auth.uid(),p.creator_id)))
  group by a.ping_id
$$;

-- Account deletion from the client. The cascade from auth.users clears the
-- profile and everything hanging off it.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id=auth.uid();
end $$;


-- ---------------------------------------------------------------------------
-- POLICIES
-- ---------------------------------------------------------------------------

create policy "profiles visible to self friends and pending requests" on public.profiles for select to authenticated using(public.can_view_profile(id));
create policy "profile owner updates profile" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

create policy "users create outgoing friend requests" on public.friendships for insert to authenticated with check(requester_id=auth.uid() and status='pending' and not public.is_blocked(requester_id,recipient_id));
create policy "users read their friendship rows" on public.friendships for select to authenticated using(requester_id=auth.uid() or recipient_id=auth.uid());
create policy "recipient accepts request" on public.friendships for update to authenticated using(recipient_id=auth.uid() and status='pending') with check(recipient_id=auth.uid() and status='accepted');
create policy "participants remove friendship" on public.friendships for delete to authenticated using(requester_id=auth.uid() or recipient_id=auth.uid());

create policy "owner manages blocks" on public.blocks for all to authenticated using(blocker_id=auth.uid()) with check(blocker_id=auth.uid() and blocked_id<>auth.uid());

create policy "reporter submits reports" on public.reports for insert to authenticated with check(reporter_id=auth.uid() and reported_id<>auth.uid());
create policy "reporter sees own reports" on public.reports for select to authenticated using(reporter_id=auth.uid());

create policy "friends read active pings" on public.pings for select to authenticated using(expires_at>now() and (creator_id=auth.uid() or (public.is_friend(auth.uid(),creator_id) and not public.is_blocked(auth.uid(),creator_id))));
create policy "friend creates own ping" on public.pings for insert to authenticated with check(creator_id=auth.uid());
create policy "creator edits own ping" on public.pings for update to authenticated using(creator_id=auth.uid()) with check(creator_id=auth.uid());
create policy "creator deletes own ping" on public.pings for delete to authenticated using(creator_id=auth.uid());

create policy "friends read their own or creator acceptances" on public.ping_acceptances for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.pings p where p.id=ping_id and p.creator_id=auth.uid()));
create policy "friend accepts active ping" on public.ping_acceptances for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.pings p where p.id=ping_id and p.expires_at>now() and p.creator_id<>auth.uid() and public.is_friend(auth.uid(),p.creator_id) and not public.is_blocked(auth.uid(),p.creator_id)));
create policy "user withdraws own acceptance" on public.ping_acceptances for delete to authenticated using(user_id=auth.uid());

create policy "owner manages notification preferences" on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and (friend_id is null or public.is_friend(user_id,friend_id)));

create policy "owner manages push devices" on public.push_devices for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());


-- ---------------------------------------------------------------------------
-- GRANTS
--
-- Revoked and reissued every run so the table list here is the whole truth.
-- `anon` is left to the project defaults: it has no policies, so RLS already
-- denies it everything.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

revoke all on
  public.profiles, public.friendships, public.blocks, public.reports,
  public.pings, public.ping_acceptances, public.notification_preferences,
  public.push_devices
  from authenticated;

grant select, insert, update, delete on
  public.profiles, public.friendships, public.blocks, public.reports,
  public.pings, public.ping_acceptances, public.notification_preferences,
  public.push_devices
  to authenticated;

-- Accepting a request is the only edit a recipient may make to a friendship, so
-- the column grant replaces the table-wide update rather than adding to it.
revoke update on public.friendships from authenticated;
grant update(status) on public.friendships to authenticated;

revoke all on function
  public.is_friend(uuid, uuid), public.is_blocked(uuid, uuid),
  public.can_view_profile(uuid), public.search_profiles(text, integer, integer),
  public.get_ping_counts(uuid[]), public.delete_my_account()
  from public;

grant execute on function
  public.is_friend(uuid, uuid), public.is_blocked(uuid, uuid),
  public.can_view_profile(uuid), public.search_profiles(text, integer, integer),
  public.get_ping_counts(uuid[]), public.delete_my_account()
  to authenticated;


-- ---------------------------------------------------------------------------
-- REALTIME
--
-- The home feed and map subscribe to these two tables. The publication is
-- created by the platform, so this only adds to it when it is there.
-- ---------------------------------------------------------------------------

do $realtime$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pings'
    ) then
      alter publication supabase_realtime add table public.pings;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ping_acceptances'
    ) then
      alter publication supabase_realtime add table public.ping_acceptances;
    end if;
  end if;
end $realtime$;
