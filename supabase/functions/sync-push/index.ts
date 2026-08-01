import {
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_BYTES,
  sha256,
  validateCanonicalSyncArchive,
} from '../_shared/sync-contract.ts';
import {
  json,
  requireSyncServer,
  SYNC_BUCKET,
  syncServerError,
} from '../_shared/sync-server.ts';

type PushBody = {
  archive: string;
  contentHash: string;
  expectedRevision: number;
  operationId: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MAX_REQUEST_BYTES = MAX_BACKUP_BYTES + 128 * 1024;

function parseBody(value: unknown): PushBody {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('invalid_request');
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();
  if (
    keys.join(',') !==
    ['archive', 'contentHash', 'expectedRevision', 'operationId'].join(',')
  )
    throw new Error('invalid_request');
  if (
    typeof body.archive !== 'string' ||
    typeof body.contentHash !== 'string' ||
    !HASH_PATTERN.test(body.contentHash) ||
    typeof body.operationId !== 'string' ||
    !UUID_PATTERN.test(body.operationId) ||
    !Number.isSafeInteger(body.expectedRevision) ||
    Number(body.expectedRevision) < 0
  )
    throw new Error('invalid_request');
  return body as PushBody;
}

function isExistingObject(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { statusCode?: unknown };
  return String(candidate.statusCode) === '409';
}

async function cleanupInactiveObject(
  admin: Awaited<ReturnType<typeof requireSyncServer>>['admin'],
  userId: string,
  objectPath: string
): Promise<void> {
  const { data } = await admin
    .from('sync_heads')
    .select('object_path')
    .eq('user_id', userId)
    .maybeSingle();
  if (data?.object_path === objectPath) return;
  await admin.storage.from(SYNC_BUCKET).remove([objectPath]);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405);
  try {
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_REQUEST_BYTES) throw new Error('oversized');
    const requestText = await request.text();
    if (new TextEncoder().encode(requestText).byteLength > MAX_REQUEST_BYTES)
      throw new Error('oversized');
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(requestText);
    } catch {
      throw new Error('invalid_request');
    }
    const body = parseBody(parsedBody);
    const { admin, userId } = await requireSyncServer(request);
    const archiveBytes = new TextEncoder().encode(body.archive);
    if (archiveBytes.byteLength > MAX_BACKUP_BYTES)
      throw new Error('oversized');
    if ((await sha256(body.archive)) !== body.contentHash)
      throw new Error('hash_mismatch');

    let archive;
    try {
      archive = validateCanonicalSyncArchive(body.archive);
    } catch {
      throw new Error('invalid_archive');
    }
    const { data: existing, error: existingError } = await admin
      .from('sync_operations')
      .select('expected_revision, accepted_revision, content_hash')
      .eq('user_id', userId)
      .eq('operation_id', body.operationId)
      .maybeSingle();
    if (existingError) throw new Error('server_failure');
    if (existing) {
      if (
        existing.expected_revision !== body.expectedRevision ||
        existing.content_hash !== body.contentHash
      )
        return json({ error: 'idempotency_mismatch' }, 409);
      return json({
        contentHash: existing.content_hash,
        idempotent: true,
        revision: existing.accepted_revision,
      });
    }

    const nextRevision = body.expectedRevision + 1;
    const objectPath = `${userId}/revisions/${nextRevision}-${body.contentHash}.titanlog`;
    const { error: uploadError } = await admin.storage
      .from(SYNC_BUCKET)
      .upload(objectPath, archiveBytes, {
        contentType: 'application/octet-stream',
        upsert: false,
      });
    const uploadedNow = !uploadError;
    if (uploadError && !isExistingObject(uploadError))
      throw new Error('server_failure');

    const { data: result, error: commitError } = await admin.rpc(
      'commit_sync_head',
      {
        p_archive_format_version: BACKUP_FORMAT_VERSION,
        p_archive_schema_version: BACKUP_SCHEMA_VERSION,
        p_byte_size: archiveBytes.byteLength,
        p_content_hash: body.contentHash,
        p_expected_revision: body.expectedRevision,
        p_object_path: objectPath,
        p_operation_id: body.operationId,
        p_summary: archive.summary,
        p_user_id: userId,
      }
    );
    const accepted = Array.isArray(result) ? result[0] : null;
    if (commitError || !accepted?.accepted) {
      if (uploadedNow)
        await cleanupInactiveObject(admin, userId, objectPath).catch(() => {});
      if (accepted?.conflict)
        return json(
          {
            contentHash: accepted.content_hash ?? null,
            error: 'stale_revision',
            revision: accepted.revision,
          },
          409
        );
      throw new Error('server_failure');
    }
    return json({
      contentHash: accepted.content_hash,
      idempotent: Boolean(accepted.idempotent),
      revision: accepted.revision,
    });
  } catch (error) {
    return syncServerError(error);
  }
});
