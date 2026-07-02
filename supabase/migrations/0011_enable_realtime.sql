-- Real-time group updates: enable Supabase Realtime on the tables the group
-- screen subscribes to, so members see each other's expenses/settlements/member
-- changes live (no manual refresh).
--
-- REPLICA IDENTITY FULL makes the old row available on UPDATE/DELETE so the
-- group_id=eq.<id> filter matches those events too. RLS still applies — members
-- only receive changes for groups they belong to.
--
-- Run this in the Supabase SQL editor. (You can also toggle Realtime per table
-- in Database -> Replication in the dashboard.)

alter table public.expenses replica identity full;
alter table public.settlements replica identity full;
alter table public.group_members replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.expenses;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.settlements;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.group_members;
exception when duplicate_object then null; end $$;
