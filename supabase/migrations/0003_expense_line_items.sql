-- expense_line_items: individual items within an expense (e.g. "Nasi Goreng", "Ayam Bakar")
create table public.expense_line_items (
  id uuid default uuid_generate_v4() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  name text not null,
  amount decimal(12, 2) not null,
  created_at timestamptz default now() not null
);

-- line_item_assignments: which users share each line item, and what fraction each pays
create table public.line_item_assignments (
  id uuid default uuid_generate_v4() primary key,
  line_item_id uuid references public.expense_line_items(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  share decimal(8, 6) not null check (share > 0 and share <= 1),
  created_at timestamptz default now() not null,
  unique(line_item_id, user_id)
);

-- RLS: members of the expense's group can read line items
alter table public.expense_line_items enable row level security;

create policy "Group members can read line items"
  on public.expense_line_items for select
  using (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_line_items.expense_id
        and gm.user_id = auth.uid()
    )
  );

create policy "Group members can insert line items"
  on public.expense_line_items for insert
  with check (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_line_items.expense_id
        and gm.user_id = auth.uid()
    )
  );

-- RLS: members of the expense's group can read assignments
alter table public.line_item_assignments enable row level security;

create policy "Group members can read assignments"
  on public.line_item_assignments for select
  using (
    exists (
      select 1 from public.expense_line_items eli
      join public.expenses e on e.id = eli.expense_id
      join public.group_members gm on gm.group_id = e.group_id
      where eli.id = line_item_assignments.line_item_id
        and gm.user_id = auth.uid()
    )
  );

create policy "Group members can insert assignments"
  on public.line_item_assignments for insert
  with check (
    exists (
      select 1 from public.expense_line_items eli
      join public.expenses e on e.id = eli.expense_id
      join public.group_members gm on gm.group_id = e.group_id
      where eli.id = line_item_assignments.line_item_id
        and gm.user_id = auth.uid()
    )
  );
