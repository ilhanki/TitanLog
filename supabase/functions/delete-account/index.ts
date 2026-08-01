import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

async function removeSyncRevisions(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const prefix = `${userId}/revisions`;
  const paths: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage
      .from('titanlog-sync')
      .list(prefix, { limit: 1000, offset });
    if (error) return false;
    const page = data ?? [];
    paths.push(...page.map((item) => `${prefix}/${item.name}`));
    if (page.length < 1000) break;
    offset += page.length;
  }
  if (paths.length === 0) return true;
  const { error } = await admin.storage.from('titanlog-sync').remove(paths);
  return !error;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey)
    return json({ error: 'server_not_configured' }, 503);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  const body = await request.json().catch(() => null);
  if (body?.confirmation !== 'DELETE_MY_ACCOUNT')
    return json({ error: 'confirmation_required' }, 400);

  const jwt = authorization.replace(/^Bearer\s+/i, '');
  let payload: { auth_time?: number };
  try {
    const encoded = jwt.split('.')[1];
    if (!encoded) throw new Error('invalid_jwt');
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
    );
  } catch {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!payload.auth_time || Date.now() / 1000 - payload.auth_time > 15 * 60) {
    return json({ error: 'recent_authentication_required' }, 403);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  if (!(await removeSyncRevisions(admin, data.user.id)))
    return json({ error: 'sync_revision_deletion_failed' }, 500);
  const { error: syncOperationError } = await admin
    .from('sync_operations')
    .delete()
    .eq('user_id', data.user.id);
  if (syncOperationError)
    return json({ error: 'sync_operation_deletion_failed' }, 500);
  const { error: syncHeadError } = await admin
    .from('sync_heads')
    .delete()
    .eq('user_id', data.user.id);
  if (syncHeadError) return json({ error: 'sync_head_deletion_failed' }, 500);
  const { error: backupError } = await admin.storage
    .from('titanlog-backups')
    .remove([`${data.user.id}/latest.titanlog`]);
  if (backupError) return json({ error: 'backup_deletion_failed' }, 500);
  const { error: metadataError } = await admin
    .from('backup_metadata')
    .delete()
    .eq('user_id', data.user.id);
  if (metadataError) return json({ error: 'metadata_deletion_failed' }, 500);
  const { error: deleteError } = await admin.auth.admin.deleteUser(
    data.user.id
  );
  if (deleteError) return json({ error: 'account_deletion_failed' }, 500);
  return json({ deleted: true }, 200);
});
