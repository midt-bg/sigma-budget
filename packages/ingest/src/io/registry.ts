import { globSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { parseDocument, isAlias, isMap, isScalar, isSeq } from 'yaml';
import { json, object, type Json } from '@sigma-budget/dataset-schema';

// Registry scalars must remain ordinary JSON values. Ambiguous YAML keys, aliases,
// timestamps, non-finite values and unsafe integers are rejected instead of coerced.
export function parseYaml(text: string): Json {
  const doc = parseDocument(text, { uniqueKeys: true, version: '1.1', schema: 'yaml-1.1' });
  if (doc.errors.length || doc.warnings.length)
    throw new Error([...doc.errors, ...doc.warnings].map((e) => e.message).join('\n'));
  function check(node: unknown): void {
    if (isAlias(node)) throw new Error('YAML aliases are not supported');
    if (isMap(node))
      for (const pair of node.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string')
          throw new Error('YAML keys must be strings');
        check(pair.value);
      }
    else if (isSeq(node)) for (const item of node.items) check(item);
    else if (isScalar(node)) {
      const v = node.value;
      if (
        typeof v === 'number' &&
        (!Number.isFinite(v) || (Number.isInteger(v) && !Number.isSafeInteger(v)))
      )
        throw new Error('Invalid YAML number');
      if (v !== null && !['string', 'boolean', 'number'].includes(typeof v))
        throw new Error('Invalid YAML scalar');
    } else if (node !== null) throw new Error('Invalid YAML node');
  }
  check(doc.contents);
  const result: unknown = doc.toJS();
  if (!json(result)) throw new Error('Invalid YAML document');
  return result;
}
export async function readYaml(path: string): Promise<Json> {
  return parseYaml(await readFile(path, 'utf8'));
}
export interface SourceEntry {
  id: string;
  acquisition: string;
  files?: { path: string; [key: string]: Json }[];
  [key: string]: Json | undefined;
}
export interface DatasetEntry {
  id: string;
  status: string;
  inputs?: string[];
  [key: string]: Json | undefined;
}
export interface SourceRegistry {
  sources: SourceEntry[];
  intermediates?: ({ path: string } & Record<string, Json>)[];
}
export interface DatasetRegistry {
  datasets: DatasetEntry[];
}
export function registries(s: Json, d: Json): [SourceRegistry, DatasetRegistry] {
  if (
    !object(s) ||
    s.schema !== 1 ||
    !Array.isArray(s.sources) ||
    !object(d) ||
    d.schema !== 1 ||
    !Array.isArray(d.datasets)
  )
    throw new Error('Invalid registry');
  const unique = (rows: unknown[], key: string) => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (!object(row) || typeof row[key] !== 'string' || !row[key] || seen.has(row[key] as string))
        throw new Error(`Invalid or duplicate ${key}`);
      seen.add(row[key] as string);
    }
  };
  unique(s.sources, 'id');
  unique(d.datasets, 'id');
  if (s.intermediates !== undefined && !Array.isArray(s.intermediates))
    throw new Error('Invalid intermediates');
  unique((s.intermediates ?? []) as unknown[], 'path');
  for (const source of s.sources)
    if (
      !object(source) ||
      typeof source.acquisition !== 'string' ||
      (source.files !== undefined &&
        (!Array.isArray(source.files) ||
          !source.files.every((f) => object(f) && typeof f.path === 'string')))
    )
      throw new Error('Invalid source');
  for (const dataset of d.datasets)
    if (
      !object(dataset) ||
      typeof dataset.status !== 'string' ||
      (dataset.inputs !== undefined &&
        (!Array.isArray(dataset.inputs) || !dataset.inputs.every((x) => typeof x === 'string')))
    )
      throw new Error('Invalid dataset');
  return [s as unknown as SourceRegistry, d as unknown as DatasetRegistry];
}
export interface InputRecord {
  kind: 'source' | 'intermediate';
  source: string | null;
  datasets: string[];
  entry: Record<string, Json>;
}
export function registryInputs(
  s: SourceRegistry,
  d: DatasetRegistry,
  inputRoot: string,
): {
  found: Record<string, InputRecord>;
  missing: Record<string, string[]>;
  sources: Record<string, SourceEntry>;
} {
  const sources = Object.fromEntries(s.sources.map((x) => [x.id, x]));
  const intermediates = Object.fromEntries((s.intermediates ?? []).map((x) => [x.path, x]));
  const found: Record<string, InputRecord> = {},
    missing: Record<string, string[]> = {};
  for (const dataset of d.datasets) {
    if (dataset.status === 'pending') continue;
    for (const input of dataset.inputs ?? []) {
      const source = sources[input],
        intermediate = intermediates[input];
      if (source && ['reference', 'generated'].includes(source.acquisition)) continue;
      const entries = source ? (source.files ?? []) : intermediate ? [intermediate] : [];
      for (const entry of entries) {
        const pattern = entry.path;
        if (!/^(data\/originals|data\/cache)(\/|$)/.test(pattern)) continue;
        if (isAbsolute(pattern) || pattern.split('/').includes('..') || pattern.includes('\\'))
          throw new Error(`Invalid input path: ${pattern}`);
        const hits = globSync(pattern, { cwd: inputRoot })
          .filter((p) => {
            const rel = relative(inputRoot, resolve(inputRoot, p));
            return (
              !rel.startsWith('..') && !isAbsolute(rel) && statSync(resolve(inputRoot, p)).isFile()
            );
          })
          .sort();
        if (!hits.length) {
          const list = (missing[pattern] ??= []);
          if (!list.includes(dataset.id)) list.push(dataset.id);
        }
        for (const hit of hits) {
          const record = (found[hit] ??= {
            kind: source ? 'source' : 'intermediate',
            source: source ? input : null,
            datasets: [],
            entry,
          });
          if (!record.datasets.includes(dataset.id)) record.datasets.push(dataset.id);
        }
      }
    }
  }
  for (const ids of Object.values(missing)) ids.sort();
  for (const rec of Object.values(found)) rec.datasets.sort();
  return { found, missing, sources };
}
