-- Claim an existing (manual) member slot when joining a group
--
-- When a group has manual members (added by name before they had an account),
-- someone joining by invite code should be able to say "that's me" and take
-- over that member row instead of creating a duplicate — their user_id gets
-- attached and the row's name is overwritten with their own display name.
--
-- 1) preview_group_by_code: lets a non-member look up a group by invite code
--    and see its unclaimed (user_id is null) members, so the join screen can
--    offer the choice before actually joining.
-- 2) join_group_by_code: gains an optional p_claim_member_id — when given, it
--    claims that member row instead of inserting a new one. The old
--    single-argument version is dropped and replaced (can't just
--    create-or-replace across an arity change).
--
-- Run this in the Supabase SQL editor.

-- ── 1. Preview a group + its unclaimed members by invite code ─────────────────
create or replace function public.preview_group_by_code(p_code text)
returns table(group_id uuid, group_name text, group_currency text, member_id uuid, member_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where invite_code = upper(trim(p_code));

  if v_group_id is null then
    raise exception 'Group not found';
  end if;

  return query
  select g.id, g.name, g.currency, gm.id, gm.name
  from public.groups g
  left join public.group_members gm on gm.group_id = g.id and gm.user_id is null
  where g.id = v_group_id;
end;
$$;

grant execute on function public.preview_group_by_code(text) to authenticated;

-- ── 2. Join by code, optionally claiming an existing member row ───────────────
drop function if exists public.join_group_by_code(text);

create or replace function public.join_group_by_code(p_code text, p_claim_member_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_display_name text;
begin
  select id into v_group_id
  from public.groups
  where invite_code = upper(trim(p_code));

  if v_group_id is null then
    raise exception 'Group not found';
  end if;

  -- Already a member — no-op.
  if exists (
    select 1 from public.group_members
    where group_id = v_group_id and user_id = auth.uid()
  ) then
    return v_group_id;
  end if;

  if p_claim_member_id is not null then
    select display_name into v_display_name from public.users where id = auth.uid();

    update public.group_members
    set user_id = auth.uid(),
        name = coalesce(v_display_name, name)
    where id = p_claim_member_id
      and group_id = v_group_id
      and user_id is null;

    if not found then
      raise exception 'That member slot is no longer available';
    end if;
  else
    insert into public.group_members (group_id, user_id)
    values (v_group_id, auth.uid());
  end if;

  return v_group_id;
end;
$$;

grant execute on function public.join_group_by_code(text, uuid) to authenticated;
