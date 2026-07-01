-- Store the itemization for scanned expenses so they can be re-edited in the
-- itemized split editor (manual expenses stay null and edit in the manual form).
-- The column doubles as the "is this a scan?" flag: null = manual, present = scan.
-- Lightweight JSON blob — no new tables; splits still drive Balances/Settle.
--
-- Shape:
--   { "items": [{ "name": "...", "amount": 100, "assignees": ["<group_members.id>"] }],
--     "tax": 0, "service": 0, "discount": 0, "currency": "IDR", "rate": 1 }
--
-- Run this in the Supabase SQL editor.

alter table public.expenses
  add column if not exists itemization jsonb;
