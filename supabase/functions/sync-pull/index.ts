import {
  json,
  requireSyncServer,
  SYNC_BUCKET,
  syncServerError,
} from '../_shared/sync-server.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405);
  try {
    const { admin, userId } = await requireSyncServer(request);
    const { data: head, error } = await admin
      .from('sync_heads')
      .select(
        'current_revision, content_hash, archive_format_version, archive_schema_version, byte_size, summary, updated_at, object_path'
      )
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error('server_failure');
    if (!head) return json({ empty: true });

    const { data: signed, error: signedError } = await admin.storage
      .from(SYNC_BUCKET)
      .createSignedUrl(head.object_path, 60, { download: true });
    if (signedError || !signed?.signedUrl) throw new Error('server_failure');
    return json({
      downloadUrl: signed.signedUrl,
      empty: false,
      head: {
        archiveFormatVersion: head.archive_format_version,
        archiveSchemaVersion: head.archive_schema_version,
        byteSize: head.byte_size,
        contentHash: head.content_hash,
        revision: head.current_revision,
        summary: head.summary,
        updatedAt: head.updated_at,
      },
    });
  } catch (error) {
    return syncServerError(error);
  }
});
