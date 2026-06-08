-- Store profile photo URLs alongside the user's public profile row.
alter table public.user_profiles
  add column if not exists avatar_url text;

comment on column public.user_profiles.avatar_url is 'Public URL for the user profile photo.';
