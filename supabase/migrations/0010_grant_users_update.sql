-- Editing your display name updates public.users. The self-update RLS policy
-- ("Users can update their own profile", auth.uid() = id) already exists from
-- 0002, but the table privilege may be missing — without it the update fails with
-- "permission denied for table users". RLS and GRANTs are independent.
--
-- Run this in the Supabase SQL editor.

grant update on public.users to authenticated;
