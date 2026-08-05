-- Prepared for TitanLog alpha.13. Apply only with explicit deployment approval.
-- Existing immutable schema-4 revisions remain readable; new heads use schema 5.

alter table public.sync_heads
  drop constraint if exists sync_heads_archive_schema_version_check;

alter table public.sync_heads
  add constraint sync_heads_archive_schema_version_check
  check (archive_schema_version in (4, 5));
