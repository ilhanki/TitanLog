import { createClient } from 'npm:@supabase/supabase-js@2';

export const SYNC_BUCKET = 'titanlog-sync';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function requireSyncServer(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization) throw new Error('unauthorized');
  const url = Deno.env.get('SUPABASE_URL');
  const publicKey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SECRET_KEY');
  if (!url || !publicKey || !serviceRoleKey)
    throw new Error('server_not_configured');

  const caller = createClient(url, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) throw new Error('unauthorized');
  return {
    admin: createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    }),
    userId: data.user.id,
  };
}

export function syncServerError(error: unknown): Response {
  const code = error instanceof Error ? error.message : 'server_failure';
  if (code === 'unauthorized') return json({ error: code }, 401);
  if (code === 'server_not_configured') return json({ error: code }, 503);
  if (['invalid_request', 'invalid_archive', 'hash_mismatch'].includes(code))
    return json({ error: code }, 400);
  if (code === 'oversized') return json({ error: code }, 413);
  return json({ error: 'server_failure' }, 500);
}
