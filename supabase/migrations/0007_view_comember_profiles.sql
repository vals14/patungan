-- Fix: members who joined with a real account show as "Unknown" to others.
--
-- The users SELECT policy is self-only (auth.uid() = id). When the app embeds
-- user:users(display_name) for OTHER group members, RLS returns null, and since a
-- joined member's group_members.name is null, the name falls back to "Unknown".
-- (Manual members are unaffected — their name lives on group_members.name.)
--
-- Allow viewing the profile of anyone who shares a group with you. A SECURITY
-- DEFINER helper does the group_members lookup as the owner, avoiding RLS
-- recursion on group_members.
--
-- Run this in the Supabase SQL editor.

create or replace function public.shares_group_with(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid()
      and b.user_id = p_user
  );
$$;

grant execute on function public.shares_group_with(uuid) to authenticated;

-- Co-members can read each other's profile (name/avatar). OR's with the existing
-- self-view policy, so you can still always see yourself.
drop policy if exists "Group members can view co-member profiles" on public.users;
create policy "Group members can view co-member profiles"
  on public.users for select
  using ( public.shares_group_with(id) );
