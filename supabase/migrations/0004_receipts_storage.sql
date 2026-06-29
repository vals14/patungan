-- Receipts storage bucket RLS policies (Plan 4).
--
-- Manual steps (do these in the Supabase dashboard before running this file):
--   Storage -> New bucket
--     Name: receipts
--     Public: OFF (private — receipts surface only via signed URLs)
--     File size limit: 10 MB
--     Allowed MIME types: image/jpeg, image/png, image/heic, image/webp
--
-- Then paste the policies below into the SQL editor and run.

-- Authenticated users can upload to the receipts bucket.
create policy "Authenticated users can upload receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and auth.role() = 'authenticated'
  );

-- Users can read receipt images they uploaded.
-- v1 keeps this owner-scoped; a stricter group-scoped read policy is deferred.
-- Sufficient for now since the bucket is private and URLs are only surfaced
-- inside expense records the group can already see.
create policy "Users can read their own receipt uploads"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and auth.uid() = owner
  );
