"""Capture law-builder inputs and independent Python expectations from pinned sources.

Extract the release-build input archive into tmp/ts-law-inputs first, then run
PYTHONPATH=pipeline tmp/venv-data/bin/python packages/ingest/test/fixtures/law/generate_oracle.py.
The Python extraction code remains authoritative; the fixture contains parsed
DV blocks, not raw HTML, and only the Parliament fields consumed by law.py.
"""
import ast
import hashlib
import json
import tarfile
from pathlib import Path

from budget_pipeline.build import law
from budget_pipeline.extract import budget_law_parser

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).parent
DATA = ROOT / 'tmp/ts-law-inputs/data'
ARCHIVE_SHA256 = '5f8e6a98b05919dc776fb68f40615a544b585e1a1690e29cf2f6f3b0e0648701'
ARCHIVE = Path('/home/user/work/sigma-budget/data/cache/snapshots/release-build-inputs-2026-11-08-indirect-tax-sources.tar.gz')

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(name, value):
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if digest(ARCHIVE) != ARCHIVE_SHA256:
    raise ValueError('Input archive SHA-256 mismatch')

law.RAW = DATA / 'originals'
cache = DATA / 'cache/law_bill.json'
ministries = ROOT / 'data/release/ministries.json'
raw = {}
blocks = {}
hashes = {'data/cache/law_bill.json': digest(cache), 'data/release/ministries.json': digest(ministries)}
literal_cases = []
for key, (bill_id, filename, _, _) in law.LAWS.items():
    path = DATA / f'originals/parliament/bill_{bill_id}.json'
    dv = DATA / 'originals/dv' / filename
    hashes[f'data/originals/parliament/bill_{bill_id}.json'] = digest(path)
    hashes[f'data/originals/dv/{filename}'] = digest(dv)
    original = read(path)
    # Keep only fields actually consumed; no proposers' names.
    keys = ('activity', 'stan_list', 'standp_list', 'proposal_12_list', 'stan_list2_1', 'dist_list', 'L_Act_sign', 'L_ActL_title', 'L_ActL_final', 'L_Act_date', 'L_Act_date2', 'L_Act_dv_iss', 'static_archive', 'order', 'file_list')
    d = {k: original[k] for k in keys if k in original}
    fields = {'activity': ('L_Act_St_date', 'L_Act_St2_name', 'L_Act_St_name'), 'stan_list': ('A_Cm_Stan_date', 'A_ns_CL_value'), 'standp_list': ('A_Cm_Stan_date', 'A_Cm_Stanid'), 'proposal_12_list': ('RN_DOC', 'DAT_DOC', 'act_files'), 'stan_list2_1': ('A_Cm_Stan_date',), 'dist_list': ('A_ns_CL_value', 'L_Act_DTL_value'), 'order': ('FILENAME',), 'file_list': ('FILENAME',)}
    for field, names in fields.items():
        d[field] = [{k: item[k] for k in names} for item in d[field]]
    for p in d['proposal_12_list']:
        files = p['act_files']
        if isinstance(files, str):
            value = ast.literal_eval(files)
            literal_cases.append({'text': files, 'expected': value})
            p['act_files'] = value
    raw[key] = d
    blocks[key] = budget_law_parser.dv_blocks(str(dv))
archive_path = DATA / 'originals/parliament' / raw['zdb']['static_archive']
archive_size = archive_path.stat().st_size if archive_path.is_file() else None
write('evidence.json', {'law': read(cache), 'parliament': raw, 'dvBlocks': blocks, 'ministries': read(ministries), 'archiveBytes': archive_size})
# Current cache already contains decoded arrays. Preserve representative literal
# inputs independently, for the adapter boundary and future parser translation.
for text in ["[{'FILENAME': 'proposal.pdf'}]", '[]', "[{'FILENAME': 'a.pdf'}, {'FILENAME': 'b.pdf'}]"]:
    literal_cases.append({'text': text, 'expected': ast.literal_eval(text)})
write('literal-data.json', literal_cases)
class Context:
    law = read(cache)
    def raw(self, path): return read(DATA / 'originals' / path)
    def get(self, path): return read(ministries) if path == 'ministries.json' else None
    def put(self, path, value): return value
expected = law.build_law(Context())
write('parliament-oracle.json', {key: law._parl(bill_id) for key, (bill_id, _, _, _) in law.LAWS.items()})
write('gazette-oracle.json', {key: law._dv_facts(filename) for key, (_, filename, _, _) in law.LAWS.items()})
write('articles-oracle.json', {'art1': law._art1(Context.law), 'rows': law._budget_rows(Context(), Context.law), 'totals': law._totals(law._budget_rows(Context(), Context.law), Context.law)})
write('oracle.json', expected)
write('next2027.json', expected['next'])
# Verify extracted archive members against the pinned archive, not just their
# locally computed hashes. The ministries input is the separately pinned release.
with tarfile.open(ARCHIVE, 'r:gz') as archive:
    for name, expected_hash in hashes.items():
        if name.startswith('data/release/'):
            continue
        member = archive.extractfile(name)
        if member is None or hashlib.sha256(member.read()).hexdigest() != expected_hash:
            raise ValueError(f'Extracted input differs from pinned archive: {name}')
write('provenance.json', {'baseline': '1843be0', 'buildDate': '2026-11-08', 'sourceArchiveSha256': ARCHIVE_SHA256, 'billArchiveBytes': archive_size, 'inputSha256': hashes, 'fixtureSha256': {name: digest(HERE / name) for name in ('evidence.json', 'literal-data.json', 'parliament-oracle.json', 'gazette-oracle.json', 'articles-oracle.json', 'oracle.json', 'next2027.json')}, 'oracle': 'Python 3.12 budget_law_parser.dv_blocks, ast.literal_eval and build.law.build_law'})
