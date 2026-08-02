import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function moduleSpecifiers(contents: string): string[] {
  return Array.from(
    contents.matchAll(
      /\b(?:import|export)\s+[\s\S]*?\sfrom\s+['"](\.[^'"]+)['"]/g
    )
  ).flatMap((match) => (match[1] ? [match[1]] : []));
}

function inspectLocalModuleGraph(entry: string): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(modulePath: string): void {
    const normalized = relative(process.cwd(), modulePath).replaceAll(
      '\\',
      '/'
    );
    expect(visiting.has(normalized)).toBe(false);
    if (visited.has(normalized)) return;
    expect(existsSync(modulePath)).toBe(true);
    expect(readdirSync(dirname(modulePath))).toContain(basename(modulePath));
    visiting.add(normalized);
    const contents = readFileSync(modulePath, 'utf8');
    expect(contents).not.toMatch(/\bimport\s*\(/);
    for (const specifier of moduleSpecifiers(contents)) {
      if (!specifier.startsWith('.')) {
        expect(specifier).toBe('npm:@supabase/supabase-js@2');
        continue;
      }
      expect(specifier).toMatch(/\.ts$/);
      visit(resolve(dirname(modulePath), specifier));
    }
    visiting.delete(normalized);
    visited.add(normalized);
  }

  visit(resolve(process.cwd(), entry));
  return [...visited].sort();
}

describe('static sync backend security contract', () => {
  const sql = source(
    'supabase/migrations/202608010001_revisioned_device_sync.sql'
  );
  const push = source('supabase/functions/sync-push/index.ts');
  const pull = source('supabase/functions/sync-pull/index.ts');
  const shared = source('supabase/functions/_shared/sync-contract.ts');
  const server = source('supabase/functions/_shared/sync-server.ts');
  const deletion = source('supabase/functions/delete-account/index.ts');
  const client = [
    source('src/features/auth/supabase-client.ts'),
    source('src/features/sync/remote-sync-client.ts'),
    source('src/features/sync/manual-sync-service.ts'),
  ].join('\n');

  it('creates a private bucket with owner-only read and no client mutation policies', () => {
    expect(sql).toContain("'titanlog-sync'");
    expect(sql).toMatch(/'titanlog-sync',[\s\S]*false,[\s\S]*20971520/);
    expect(sql).toContain('Users read own immutable sync revisions');
    expect(sql).toContain('owner_id = (select auth.uid())::text');
    expect(sql).toContain('There are deliberately no client INSERT');
    expect(sql).not.toMatch(
      /create policy[^;]+on storage\.objects for (insert|update|delete)[^;]+titanlog-sync/i
    );
    expect(sql).not.toMatch(/titanlog-sync[^;]+public\s*=\s*true/i);
  });

  it('keeps head mutation server-only and performs atomic stale-write CAS', () => {
    expect(sql).toContain(
      'alter table public.sync_heads enable row level security'
    );
    expect(sql).toContain('Users read own sync head');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('for update');
    expect(sql).toContain('<> p_expected_revision');
    expect(sql).toContain('return query select false, true');
    expect(sql).toContain('grant execute on function public.commit_sync_head');
    expect(sql).toContain('to service_role');
    expect(sql).toContain('revoke all on function public.commit_sync_head');
  });

  it('makes operation IDs idempotent without accepting account identity from input', () => {
    expect(sql).toContain('primary key (user_id, operation_id)');
    expect(sql).toContain('idempotency_mismatch');
    expect(push).toContain(
      "['archive', 'contentHash', 'expectedRevision', 'operationId']"
    );
    expect(push).not.toMatch(/body\.user(Id|_id)|body\[['"]user/i);
    expect(push).toContain(
      'const { admin, userId } = await requireSyncServer(request)'
    );
    expect(server).toContain('caller.auth.getUser()');
  });

  it('checks size, hash, strict shared validation, and compensates safely', () => {
    expect(push.indexOf('declaredLength')).toBeLessThan(
      push.indexOf('JSON.parse')
    );
    expect(push).toContain('MAX_BACKUP_BYTES');
    expect(push).toContain("throw new Error('hash_mismatch')");
    expect(push).toContain('validateCanonicalSyncArchive(body.archive)');
    expect(push).toContain('cleanupInactiveObject');
    expect(push).toContain(".eq('user_id', userId)");
    expect(shared).toContain(
      '../../../src/features/data-safety/backup-serialization.ts'
    );
    expect(shared).toContain('containsSecretShapedKey');
    expect(shared).toContain("throw new Error('non_canonical')");
  });

  it('keeps the complete sync-push local module graph Deno-resolvable', () => {
    expect(
      inspectLocalModuleGraph('supabase/functions/sync-push/index.ts')
    ).toEqual([
      'src/features/data-safety/backup-contract.ts',
      'src/features/data-safety/backup-serialization.ts',
      'src/features/data-safety/backup-types.ts',
      'src/features/data-safety/backup-validator.ts',
      'supabase/functions/_shared/sync-contract.ts',
      'supabase/functions/_shared/sync-server.ts',
      'supabase/functions/sync-push/index.ts',
    ]);
    expect(
      source('src/features/data-safety/backup-serialization.ts')
    ).toContain("from './backup-validator.ts'");
  });

  it('returns empty cloud or a short-lived private URL without public access', () => {
    expect(pull).toContain('return json({ empty: true })');
    expect(pull).toContain('createSignedUrl(head.object_path, 60');
    expect(pull).not.toMatch(/getPublicUrl|publicUrl/);
    expect(pull).toContain(".eq('user_id', userId)");
  });

  it('keeps service credentials out of the application bundle and logs no archive data', () => {
    expect(client).not.toMatch(/SUPABASE_(SERVICE_ROLE|SECRET)_KEY/);
    expect(client).not.toMatch(/console\.(log|warn|error)/);
    expect(push).not.toMatch(/console\.(log|warn|error)/);
    expect(pull).not.toMatch(/console\.(log|warn|error)/);
    expect(server).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('blocks account deletion when sync cleanup fails', () => {
    expect(deletion).toContain('removeSyncRevisions');
    expect(deletion).toContain('sync_revision_deletion_failed');
    expect(deletion).toContain('sync_operation_deletion_failed');
    expect(deletion).toContain('sync_head_deletion_failed');
    expect(deletion.indexOf('removeSyncRevisions')).toBeLessThan(
      deletion.indexOf('admin.auth.admin.deleteUser')
    );
  });
});
