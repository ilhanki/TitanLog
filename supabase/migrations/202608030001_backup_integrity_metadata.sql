-- Integrity metadata for private manual cloud-backup downloads.
alter table public.backup_metadata
add column if not exists byte_size bigint,
add column if not exists content_hash text;

alter table public.backup_metadata
drop constraint if exists backup_metadata_byte_size_check;

alter table public.backup_metadata
add constraint backup_metadata_byte_size_check
check (byte_size is null or byte_size between 1 and 20971520);

alter table public.backup_metadata
drop constraint if exists backup_metadata_content_hash_check;

alter table public.backup_metadata
add constraint backup_metadata_content_hash_check
check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');

comment on column public.backup_metadata.byte_size is
'Exact UTF-8 byte size of the latest private manual backup object.';

comment on column public.backup_metadata.content_hash is
'Lowercase SHA-256 of the exact latest private manual backup object bytes.';
