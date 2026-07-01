-- Invite & Join Groups
--
-- 1) join_group_by_code RPC: a non-member cannot SELECT a group by invite_code
--    (the groups SELECT policy is members-only), which breaks join-by-code. A
--    SECURITY DEFINER function looks up the group and adds the caller as a member
--    atomically, safely bypassing that policy. Mirrors the create_group RPC.
-- 2) Equal member permissions: any group member can edit/delete ANY expense in
--    the group (add/view are already group-based). This also puts the edit/delete
--    policies — previously added by hand — into a committed migration.
--
-- Run this in the Supabase SQL editor.

-- ── 1. Join by code ──────────────────────────────────────────────────────────
create or replace function public.join_group_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id
  from public.groups
  where invite_code = upper(trim(p_code));

  if v_group_id is null then
    raise exception 'Group not found';
  end if;

  -- Add the caller as a member if they aren't one already.
  if not exists (
    select 1 from public.group_members
    where group_id = v_group_id and user_id = auth.uid()
  ) then
    insert into public.group_members (group_id, user_id)
    values (v_group_id, auth.uid());
  end if;

  return v_group_id;
end;
$$;

grant execute on function public.join_group_by_code(text) to authenticated;

-- ── 2. Equal member permissions on expenses ──────────────────────────────────
-- Any group member can update/delete any expense in that group.
drop policy if exists "Group members can update expenses" on public.expenses;
create policy "Group members can update expenses"
  on public.expenses for update
  using (
    group_id in (select group_id from public.group_members where user_id = auth.uid())
  );

drop policy if exists "Group members can delete expenses" on public.expenses;
create policy "Group members can delete expenses"
  on public.expenses for delete
  using (
    group_id in (select group_id from public.group_members where user_id = auth.uid())
  );

-- Editing an expense replaces its splits (delete + reinsert) and deleting an
-- expense removes its splits — both must work for any group member.
drop policy if exists "Group members can delete splits" on public.expense_splits;
create policy "Group members can delete splits"
  on public.expense_splits for delete
  using (
    expense_id in (
      select e.id from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where gm.user_id = auth.uid()
    )
  );

-- Table privileges are independent of RLS.
grant update, delete on public.expenses to authenticated;
grant delete on public.expense_splits to authenticated;
