alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;

create policy "Users can view their own profile"
  on public.users for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.users for insert with check (auth.uid() = id);

create policy "Group members can view their groups"
  on public.groups for select using (
    id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  );

create policy "Authenticated users can create groups"
  on public.groups for insert with check (auth.uid() = created_by);

create policy "Group members can view memberships"
  on public.group_members for select using (
    group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  );

create policy "Users can join groups"
  on public.group_members for insert with check (auth.uid() = user_id);

create policy "Group members can view expenses"
  on public.expenses for select using (
    group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  );

create policy "Group members can add expenses"
  on public.expenses for insert with check (
    group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  );

create policy "Group members can view splits"
  on public.expense_splits for select using (
    expense_id in (
      select e.id from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where gm.user_id = auth.uid()
    )
  );

create policy "Group members can add splits"
  on public.expense_splits for insert with check (
    expense_id in (
      select e.id from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where gm.user_id = auth.uid()
    )
  );

create policy "Group members can update their own splits"
  on public.expense_splits for update using (user_id = auth.uid());

create policy "Group members can view settlements"
  on public.settlements for select using (
    group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  );

create policy "Group members can add settlements"
  on public.settlements for insert with check (
    group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  );
