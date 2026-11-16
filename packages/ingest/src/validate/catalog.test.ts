import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  appendFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { applyWave17aExceptions } from './wave17a.js';
import { core } from './catalog.js';
import { Context } from './context.js';
const base = new URL('../../test/fixtures/validate17a/', import.meta.url);
const load = (p: string): any => JSON.parse(readFileSync(new URL(p, base), 'utf8'));
function mutate(root: string, op: any) {
  const p = join(root, op.file);
  mkdirSync(dirname(p), { recursive: true });
  if (op.op === 'deleteFile') unlinkSync(p);
  else if (op.op === 'write') writeFileSync(p, op.value);
  else if (op.op === 'append') appendFileSync(p, op.value);
  else if (op.op === 'replace') {
    const s = readFileSync(p, 'utf8');
    if (s.split(op.old).length !== 2) throw Error('replacement must be unique');
    writeFileSync(p, s.replace(op.old, op.value));
  } else {
    const obj = JSON.parse(readFileSync(p, 'utf8'));
    let x = obj;
    for (const k of op.path.slice(0, -1)) x = x[k];
    if (op.op === 'deleteKey') delete x[op.path.at(-1)];
    else x[op.path.at(-1)] = op.op === 'rawSet' ? '__review_raw_number__' : op.value;
    let text = JSON.stringify(obj);
    if (op.op === 'rawSet') text = text.replace('"__review_raw_number__"', op.value);
    writeFileSync(p, text);
  }
}
it('does not accept new drift just because older production patterns are broad', () => {
  const root = mkdtempSync(join(tmpdir(), 'sigma-17a-drift-'));
  try {
    cpSync(new URL('corpus/', base), root, { recursive: true });
    const op = load('cases-extra.json').find((x: any) => x.name === 'source-missing-key').ops[0];
    mutate(root, op);
    const check = core(new Context(root));
    const result = applyWave17aExceptions(check);
    expect(result).toHaveLength(0);
    expect(check.problems.some((x) => x.startsWith('sources: keys'))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
