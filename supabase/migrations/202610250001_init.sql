create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  avatar_url text,
  created_at timestamptz not null default now()
);
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique(requester_id, recipient_id),
  check(requester_id <> recipient_id)
);
create index friendships_recipient_status_idx on public.friendships(recipient_id,status);
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id), check(blocker_id <> blocked_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);
create table public.pings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  activity text not null check(activity in ('Coffee','Study','Gym','Food','Walk','Sports','Party','Other')),
  description text check(char_length(description) <= 240),
  location_name text check(char_length(location_name) <= 120),
  latitude double precision check(latitude between -90 and 90),
  longitude double precision check(longitude between -180 and 180),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  visibility text not null default 'friends' check(visibility = 'friends'),
  created_at timestamptz not null default now(),
  check(expires_at > starts_at and expires_at <= starts_at + interval '24 hours'),
  check((latitude is null) = (longitude is null))
);
create index pings_expiry_idx on public.pings(expires_at);
create index pings_creator_idx on public.pings(creator_id,expires_at);
create table public.ping_acceptances (
  ping_id uuid not null references public.pings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(ping_id,user_id)
);
create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid references public.profiles(id) on delete cascade,
  activity text check(activity is null or activity in ('Coffee','Study','Gym','Food','Walk','Sports','Party','Other')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique nulls not distinct(user_id,friend_id,activity),
  check(friend_id is null or friend_id <> user_id)
);
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check(platform in ('ios','android')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
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
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.is_friend(a uuid,b uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (a=auth.uid() or b=auth.uid()) and exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=a and f.recipient_id=b) or (f.requester_id=b and f.recipient_id=a)))
$$;
create function public.is_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (a=auth.uid() or b=auth.uid()) and exists(select 1 from public.blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a))
$$;
create function public.can_view_profile(profile_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select profile_id=auth.uid() or (not public.is_blocked(auth.uid(),profile_id) and (public.is_friend(auth.uid(),profile_id) or exists(select 1 from public.friendships f where f.status='pending' and ((f.requester_id=auth.uid() and f.recipient_id=profile_id) or (f.recipient_id=auth.uid() and f.requester_id=profile_id))) or exists(select 1 from public.ping_acceptances a join public.pings p on p.id=a.ping_id where a.user_id=profile_id and p.creator_id=auth.uid())))
$$;
create function public.search_profiles(search_prefix text,page_size integer default 12,page_offset integer default 0)
returns table(id uuid,username text,display_name text) language sql stable security definer set search_path = '' as $$
  select p.id,p.username,p.display_name from public.profiles p
  where auth.uid() is not null and char_length(trim(search_prefix)) between 2 and 24
    and left(p.username,char_length(trim(search_prefix)))=lower(trim(search_prefix)) and p.id<>auth.uid()
    and not public.is_blocked(auth.uid(),p.id)
    and not exists(select 1 from public.friendships f where (f.requester_id=auth.uid() and f.recipient_id=p.id) or (f.requester_id=p.id and f.recipient_id=auth.uid()))
  order by p.username limit greatest(1,least(coalesce(page_size,12),25)) offset greatest(0,coalesce(page_offset,0))
$$;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.pings enable row level security;
alter table public.ping_acceptances enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_devices enable row level security;

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

create function public.get_ping_counts(ping_ids uuid[]) returns table(ping_id uuid,total bigint)
language sql stable security definer set search_path = '' as $$
  select a.ping_id,count(*) from public.ping_acceptances a
  join public.pings p on p.id=a.ping_id
  where a.ping_id=any(ping_ids) and p.expires_at>now()
    and (p.creator_id=auth.uid() or (public.is_friend(auth.uid(),p.creator_id) and not public.is_blocked(auth.uid(),p.creator_id)))
  group by a.ping_id
$$;
revoke all on function public.get_ping_counts(uuid[]) from public;
grant execute on function public.get_ping_counts(uuid[]) to authenticated;
revoke all on function public.is_friend(uuid,uuid),public.is_blocked(uuid,uuid),public.can_view_profile(uuid),public.search_profiles(text,integer,integer) from public;
grant execute on function public.is_friend(uuid,uuid),public.is_blocked(uuid,uuid),public.can_view_profile(uuid),public.search_profiles(text,integer,integer) to authenticated;

create function public.delete_my_account() returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id=auth.uid();
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles,public.friendships,public.blocks,public.reports,public.pings,public.ping_acceptances,public.notification_preferences,public.push_devices to authenticated;
revoke update on public.friendships from authenticated;
grant update(status) on public.friendships to authenticated;
grant execute on function public.is_friend(uuid,uuid),public.is_blocked(uuid,uuid) to authenticated;
grant execute on function public.can_view_profile(uuid),public.search_profiles(text,integer,integer) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pings') then alter publication supabase_realtime add table public.pings; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ping_acceptances') then alter publication supabase_realtime add table public.ping_acceptances; end if;
  end if;
end $$;
