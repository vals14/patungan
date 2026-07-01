-- Removing a member must actually remove them.
--
-- group_members had only SELECT + INSERT policies. With no DELETE policy the
-- remove silently affects 0 rows, so the member is never removed and keeps
-- access. Once their row is gone, every other policy (all keyed on membership)
-- revokes their access and drops the group from their list automatically —
-- so this one policy is all that's needed for "leave the group = lose access".
--
-- Any group member can remove members of their group (equal-permission model).
-- A SECURITY DEFINER helper does the membership check to avoid RLS recursion on
-- group_members.
--
-- Run this in the Supabase SQL editor.

create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid()
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated;

drop policy if exists "Group members can remove members" on public.group_members;
create policy "Group members can remove members"
  on public.group_members for delete
  using ( public.is_group_member(group_id) );

grant delete on public.group_members to authenticated;
