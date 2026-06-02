-- Create public storage bucket for card media attachments (photos/videos/voice)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-media',
  'card-media',
  true,
  10485760, -- 10 MB
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'audio/webm',
    'audio/m4a',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-m4a'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Drop and recreate policies so this migration can safely rerun if the bucket
-- or policies were created manually before migration history was recorded.
drop policy if exists "Authenticated users can upload card media" on storage.objects;
drop policy if exists "Card media is publicly readable" on storage.objects;
drop policy if exists "Users can delete their own card media" on storage.objects;

-- Allow authenticated users to upload their own files
create policy "Authenticated users can upload card media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'card-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone to read card media (cards are shared with recipients)
create policy "Card media is publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'card-media');

-- Allow users to delete their own uploads
create policy "Users can delete their own card media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'card-media' and (storage.foldername(name))[1] = auth.uid()::text);
