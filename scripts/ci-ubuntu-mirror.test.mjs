import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('canonical mirror preserves repositories, security sources and signing keys', () => {
  const root = mkdtempSync(join(tmpdir(), 'apt mirror '));
  try {
    const apt = join(root, 'apt');
    mkdirSync(join(apt, 'sources.list.d'), { recursive: true });
    const legacy = 'deb http://azure.archive.ubuntu.com/ubuntu noble main universe\n';
    const deb822 =
      'Types: deb\nURIs: https://azure.archive.ubuntu.com/ubuntu/\nSuites: noble noble-updates\nComponents: main universe\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n';
    const thirdParty =
      'deb https://example.invalid/ubuntu noble main\ndeb https://security.ubuntu.com/ubuntu noble-security main\n';
    writeFileSync(join(apt, 'sources.list'), legacy);
    const mirrors = 'http://azure.archive.ubuntu.com/ubuntu/\nhttps://archive.ubuntu.com/ubuntu/\n';
    writeFileSync(join(apt, 'apt-mirrors.txt'), mirrors);
    writeFileSync(join(apt, 'sources.list.d/ubuntu.sources'), deb822);
    writeFileSync(join(apt, 'sources.list.d/vendor.list'), thirdParty);
    const external = join(root, 'external');
    writeFileSync(external, legacy);
    symlinkSync(external, join(apt, 'sources.list.d/link.list'));
    execFileSync('bash', [resolve('scripts/ci-ubuntu-mirror.sh'), apt]);
    assert.equal(
      readFileSync(join(apt, 'sources.list'), 'utf8'),
      legacy.replace('http://azure.archive', 'https://archive'),
    );
    assert.equal(
      readFileSync(join(apt, 'sources.list.d/ubuntu.sources'), 'utf8'),
      deb822.replace('azure.archive', 'archive'),
    );
    assert.equal(readFileSync(join(apt, 'sources.list.d/vendor.list'), 'utf8'), thirdParty);
    assert.equal(readFileSync(external, 'utf8'), legacy);
    assert.equal(
      readFileSync(join(apt, 'apt-mirrors.txt'), 'utf8'),
      mirrors.replace('http://azure.archive', 'https://archive'),
    );
    execFileSync('bash', [resolve('scripts/ci-ubuntu-mirror.sh'), apt]);
    assert.equal(
      readFileSync(join(apt, 'sources.list.d/ubuntu.sources'), 'utf8'),
      deb822.replace('azure.archive', 'archive'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
