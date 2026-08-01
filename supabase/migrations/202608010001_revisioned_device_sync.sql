-- TitanLog Sprint 10-11: private immutable device-sync revisions.
-- Storage objects and PostgreSQL metadata are intentionally not presented as
-- one physical transaction. The immutable object is uploaded first and this
-- migration provides the atomic compare-and-swap metadata pointer.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'titanlog-sync',
  'titanlog-sync',
  false,
  20971520,
  array['application/octet-stream', 'application/json']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.sync_heads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_revision bigint not null check (current_revision > 0),
  object_path text not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  archive_format_version integer not null check (archive_format_version = 1),
  archive_schema_version integer not null check (archive_schema_version = 4),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  summary jsonb not null,
  updated_at timestamptz not null default now(),
  check (object_path like user_id::text || '/revisions/%')
);

create table if not exists public.sync_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  expected_revision bigint not null check (expected_revision >= 0),
  accepted_revision bigint not null check (accepted_revision > 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  object_path text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id),
  check (object_path like user_id::text || '/revisions/%')
);

alter table public.sync_heads enable row level security;
alter table public.sync_operations enable row level security;

drop policy if exists "Users read own sync head" on public.sync_heads;
create policy "Users read own sync head"
on public.sync_heads for select to authenticated
using ((select auth.uid()) = user_id);

-- No authenticated INSERT/UPDATE/DELETE policies exist for sync_heads or
-- sync_operations. Only verified Edge Functions may mutate the remote head.

drop policy if exists "Users read own immutable sync revisions" on storage.objects;
create policy "Users read own immutable sync revisions"
on storage.objects for select to authenticated
using (
  bucket_id = 'titanlog-sync'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = 'revisions'
);

-- There are deliberately no client INSERT, UPDATE, DELETE, or public policies
-- for titanlog-sync. Revisions are immutable and server-controlled.

create or replace function public.commit_sync_head(
  p_user_id uuid,
  p_operation_id uuid,
  p_expected_revision bigint,
  p_object_path text,
  p_content_hash text,
  p_archive_format_version integer,
  p_archive_schema_version integer,
  p_byte_size bigint,
  p_summary jsonb
)
returns table (
  accepted boolean,
  conflict boolean,
  revision bigint,
  content_hash text,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_operation public.sync_operations%rowtype;
  current_head public.sync_heads%rowtype;
  next_revision bigint;
  expected_path text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into existing_operation
  from public.sync_operations
  where user_id = p_user_id and operation_id = p_operation_id;

  if found then
    if existing_operation.expected_revision <> p_expected_revision
       or existing_operation.content_hash <> p_content_hash
       or existing_operation.object_path <> p_object_path then
      raise exception 'idempotency_mismatch' using errcode = '22023';
    end if;
    return query select true, false, existing_operation.accepted_revision,
      existing_operation.content_hash, true;
    return;
  end if;

  select * into current_head
  from public.sync_heads
  where user_id = p_user_id
  for update;

  if coalesce(current_head.current_revision, 0) <> p_expected_revision then
    return query select false, true,
      coalesce(current_head.current_revision, 0), current_head.content_hash,
      false;
    return;
  end if;

  next_revision := p_expected_revision + 1;
  expected_path := p_user_id::text || '/revisions/' || next_revision::text ||
    '-' || p_content_hash || '.titanlog';
  if p_object_path <> expected_path then
    raise exception 'invalid_object_path' using errcode = '22023';
  end if;

  insert into public.sync_heads (
    user_id, current_revision, object_path, content_hash,
    archive_format_version, archive_schema_version, byte_size, summary,
    updated_at
  ) values (
    p_user_id, next_revision, p_object_path, p_content_hash,
    p_archive_format_version, p_archive_schema_version, p_byte_size, p_summary,
    now()
  )
  on conflict (user_id) do update set
    current_revision = excluded.current_revision,
    object_path = excluded.object_path,
    content_hash = excluded.content_hash,
    archive_format_version = excluded.archive_format_version,
    archive_schema_version = excluded.archive_schema_version,
    byte_size = excluded.byte_size,
    summary = excluded.summary,
    updated_at = excluded.updated_at;

  insert into public.sync_operations (
    user_id, operation_id, expected_revision, accepted_revision,
    content_hash, object_path
  ) values (
    p_user_id, p_operation_id, p_expected_revision, next_revision,
    p_content_hash, p_object_path
  );

  return query select true, false, next_revision, p_content_hash, false;
end;
$$;

revoke all on function public.commit_sync_head(
  uuid, uuid, bigint, text, text, integer, integer, bigint, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_sync_head(
  uuid, uuid, bigint, text, text, integer, integer, bigint, jsonb
) to service_role;
