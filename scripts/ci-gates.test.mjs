import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const workflow = readFileSync('.github/workflows/site.yml', 'utf8');
test('one Node suite command and explicit deploy barrier', () => {
  assert.equal((workflow.match(/run: pnpm test -- --coverage/g) || []).length, 1);
  assert.equal((workflow.match(/vitest run/g) || []).length, 0);
  assert.match(workflow, /deploy:\n    needs: \[required-validation\]/);
  const deps = workflow
    .match(/required-validation:[\s\S]*?needs:\s*\[([^\]]+)\]/)[1]
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const jobs = [
    ...workflow.slice(workflow.indexOf('jobs:\n')).matchAll(/^  ([a-z][\w-]*):\n(?:    |\n)/gm),
  ]
    .map((x) => x[1])
    .filter((x) => !['deploy', 'required-validation'].includes(x));
  for (const job of jobs) assert.ok(deps.includes(job), `missing gate ${job}`);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}[\s\S]*Every validation must succeed/);
});
test('all independent Python and provenance commands survive the consolidation', () => {
  const evidence = JSON.parse(readFileSync('scripts/ci-provenance-commands.json', 'utf8'));
  for (const [path, commands] of Object.entries(evidence)) {
    const current = readFileSync(path, 'utf8')
      .split('\n')
      .map((x) => x.trim().replace(/^- run: /, ''));
    for (const command of commands) assert.ok(current.includes(command), command);
  }
  const wave = readFileSync('.github/workflows/wave15b-validation.yml', 'utf8');
  assert.match(wave, /workflow_call:/);
  assert.doesNotMatch(wave, /vitest run/);
});

test('security covers other PR targets without duplicating main PR checks', () => {
  const { parse } = createRequire(new URL('../packages/ingest/package.json', import.meta.url))(
    'yaml',
  );
  const site = parse(workflow);
  const security = parse(readFileSync('.github/workflows/security.yml', 'utf8'));
  assert.deepEqual(site.on.pull_request.branches, ['main']);
  assert.deepEqual(security.on.pull_request, { 'branches-ignore': ['main'] });
  assert.ok(Object.hasOwn(security.on, 'workflow_call'));
  assert.deepEqual(Object.keys(security.jobs).sort(), ['dependencies-and-secrets', 'semgrep']);
});

test('ETL coverage includes the standalone entry point and retains shared production globs', async () => {
  const { default: config } = await import('../apps/etl/vitest.config.ts');
  assert.deepEqual(config.test.coverage.include, [
    'src/**/*.{ts,js}',
    'bin/**/*.js',
    'publication-documents/prepare.mjs',
  ]);
});
