-- Plan 6: make settlements consistent with the balance model.
--
-- expenses.paid_by and expense_splits.user_id were retargeted to group_members.id
-- (so manual members work). settlements.from_user/to_user still pointed at users.id,
-- which can't offset those balances and excludes manual members. Retarget them to
-- group_members.id, add the undo (delete) policy, and GRANT delete (RLS != privileges).
--
-- Run this in the Supabase SQL editor.

-- 1. Retarget the participant FKs to group_members. Keep the constraint NAMES the
--    same so the PostgREST hints (group_members!settlements_from_user_fkey) resolve.
alter table public.settlements drop constraint if exists settlements_from_user_fkey;
alter table public.settlements drop constraint if exists settlements_to_user_fkey;

alter table public.settlements
  add constraint settlements_from_user_fkey
  foreign key (from_user) references public.group_members(id) on delete cascade;

alter table public.settlements
  add constraint settlements_to_user_fkey
  foreign key (to_user) references public.group_members(id) on delete cascade;

-- 2. Undo needs delete permission. Plan 1 only added select/insert policies.
drop policy if exists "Group members can delete settlements" on public.settlements;
create policy "Group members can delete settlements"
  on public.settlements for delete
  using (
    group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  );

-- 3. Table privileges are independent of RLS. DELETE is easy to forget — without it
--    undo fails with "permission denied for table settlements".
grant select, insert, delete on public.settlements to authenticated;
