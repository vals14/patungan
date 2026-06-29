create extension if not exists "uuid-ossp";

create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  phone text,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now() not null,
  constraint users_email_or_phone check (email is not null or phone is not null)
);

create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  currency text not null default 'IDR',
  invite_code text not null unique,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now() not null
);

create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  unique(group_id, user_id)
);

create type expense_category as enum (
  'Food', 'Transport', 'Accommodation', 'Activity', 'Shopping', 'Other'
);

create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  paid_by uuid references public.users(id) on delete set null,
  title text not null,
  total_amount decimal(12, 2) not null,
  currency text not null,
  exchange_rate_to_group_currency decimal(18, 6),
  category expense_category not null default 'Other',
  receipt_image_url text,
  created_at timestamptz default now() not null
);

create table public.expense_splits (
  id uuid default uuid_generate_v4() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  amount_owed decimal(12, 2) not null,
  is_settled boolean not null default false,
  unique(expense_id, user_id)
);

create table public.settlements (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  from_user uuid references public.users(id) on delete set null,
  to_user uuid references public.users(id) on delete set null,
  amount decimal(12, 2) not null,
  method text not null default 'manual',
  settled_at timestamptz default now() not null
);

create or replace view public.user_group_balances as
  select
    es.user_id,
    e.group_id,
    sum(case when es.is_settled = false then es.amount_owed else 0 end) as total_owed,
    sum(case when e.paid_by = es.user_id and es.is_settled = false then es.amount_owed else 0 end) as total_paid_for_others
  from public.expense_splits es
  join public.expenses e on e.id = es.expense_id
  group by es.user_id, e.group_id;
