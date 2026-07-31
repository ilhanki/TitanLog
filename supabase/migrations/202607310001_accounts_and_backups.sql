-- TitanLog Sprint 9: private, manual, single-object backups.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'titanlog-backups',
  'titanlog-backups',
  false,
  20971520,
  array['application/json']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.backup_metadata (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  format_version integer not null check (format_version = 1),
  app_version text not null,
  summary jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.backup_metadata enable row level security;

drop policy if exists "Users read own backup metadata" on public.backup_metadata;
create policy "Users read own backup metadata"
on public.backup_metadata for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own backup metadata" on public.backup_metadata;
create policy "Users insert own backup metadata"
on public.backup_metadata for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own backup metadata" on public.backup_metadata;
create policy "Users update own backup metadata"
on public.backup_metadata for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own backup metadata" on public.backup_metadata;
create policy "Users delete own backup metadata"
on public.backup_metadata for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users read own backup object" on storage.objects;
create policy "Users read own backup object"
on storage.objects for select to authenticated
using (
  bucket_id = 'titanlog-backups'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name = (select auth.uid())::text || '/latest.titanlog'
);

drop policy if exists "Users insert own backup object" on storage.objects;
create policy "Users insert own backup object"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'titanlog-backups'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name = (select auth.uid())::text || '/latest.titanlog'
);

drop policy if exists "Users update own backup object" on storage.objects;
create policy "Users update own backup object"
on storage.objects for update to authenticated
using (
  bucket_id = 'titanlog-backups'
  and name = (select auth.uid())::text || '/latest.titanlog'
)
with check (
  bucket_id = 'titanlog-backups'
  and name = (select auth.uid())::text || '/latest.titanlog'
);

drop policy if exists "Users delete own backup object" on storage.objects;
create policy "Users delete own backup object"
on storage.objects for delete to authenticated
using (
  bucket_id = 'titanlog-backups'
  and name = (select auth.uid())::text || '/latest.titanlog'
);
