-- One-time update for an existing PingMe database. Run in Supabase SQL Editor.
-- supabase/schema.sql remains the source of truth for the complete database.
begin;
create or replace function public.get_ping_attendees(target_ping_id uuid)
returns table(user_id uuid,username text,display_name text)
language sql stable security definer set search_path = '' as $$
  select a.user_id,profile.username,profile.display_name
  from public.ping_acceptances a
  join public.pings p on p.id=a.ping_id
  join public.profiles profile on profile.id=a.user_id
  where auth.uid() is not null and p.id=target_ping_id and p.expires_at>now()
    and (p.creator_id=auth.uid() or (public.is_friend(auth.uid(),p.creator_id) and not public.is_blocked(auth.uid(),p.creator_id)))
    and not public.is_blocked(auth.uid(),a.user_id)
  order by lower(coalesce(nullif(trim(profile.display_name),''),profile.username)),a.user_id
$$;
revoke all on function public.get_ping_attendees(uuid) from public, anon;
grant execute on function public.get_ping_attendees(uuid) to authenticated;
commit;
