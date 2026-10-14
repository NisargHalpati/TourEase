-- Run in the Supabase SQL Editor to enable browser uploads to the existing public bucket.
-- Storage RLS is scoped to each authenticated user's own first path segment.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspiration-images',
  'inspiration-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view inspiration images"
on storage.objects for select
to public
using (bucket_id = 'inspiration-images');

create policy "Users can upload their own inspiration images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'inspiration-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own inspiration images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'inspiration-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

