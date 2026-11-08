"""Regenerate Python oracle for job 02 from the named archive and this checkout.

Extract the archive's data/originals/asbp/asbp_tables.json into tmp/ts-common-inputs first.
Run with PYTHONPATH=pipeline and Python 3.12 with pipeline requirements installed.
"""
import hashlib
import json
from pathlib import Path
import yaml
from budget_pipeline import cli
from budget_pipeline.build import data_io, forecast_tables, definitions
from budget_pipeline.validate.execution_contract import numbers

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).parent
source = ROOT / 'tmp/ts-common-inputs/data/originals/asbp/asbp_tables.json'
original = json.loads(source.read_text(encoding='utf8'))
fixture = {'tables': {k: original['tables'][k] for k in ['annex3_mln', 'annex3_pct_gdp']}, 'docx_check': original['docx_check']}
def write(name, value):
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
write('asbp-tables.json', fixture)
forecast_tables.RAW = source.parent.parent
annex = forecast_tables.load()
write('annex.json', {'annex': annex, 'problems': forecast_tables.check_sums(annex)})
write('registries.json', [yaml.safe_load((ROOT / 'data' / f'{name}.yaml').read_text(encoding='utf8')) for name in ('sources', 'datasets')])
# Exercise registry_inputs using the real Python implementation on a small, fixed input tree.
maproot = HERE / 'source-map'
sources = yaml.safe_load((maproot / 'data-sources.yaml').read_text())
datasets = yaml.safe_load((maproot / 'data-datasets.yaml').read_text())
old = cli.yaml_load
cli.yaml_load = lambda p: sources if p.name == 'sources.yaml' else datasets
found, missing, source_map = cli.registry_inputs(ROOT, maproot)
cli.yaml_load = old
for entry in found.values(): entry['datasets'] = sorted(entry['datasets'])
write('source-map.json', {'found': found, 'missing': missing, 'sources': source_map})
execution = numbers(json.loads((ROOT / 'data/release/execution.json').read_text(encoding='utf8')))
write('execution-numbers.json', execution)
write('format.json', {'number': [definitions.fmt_num(v, 2, True) for v in [1234.56, -0.001, -42.5, None]], 'ties': [definitions.fmt_num(v, 0) for v in [2.5, 3.5, -2.5]], 'percent': definitions.fmt_pct(12.3), 'money': [definitions.fmt_money(v) for v in [1234.5, 100, 12.3, None]], 'thousands': definitions.fmt_khil(4567), 'euro': definitions.fmt_eur(4567), 'dates': [definitions.fmt_date('2026-11-08'), definitions.fmt_date('2026-11-08', True), definitions.fmt_date(None)], 'month': definitions.month_name(8)})
definitions.set_kfp_pending(execution)
write('source-definitions.json', {'sources': definitions.SOURCES, 'pending': definitions.PENDING_DEFS, 'block': definitions.pending_block('P04', note='test')})
js = {'id': ['geo', 'time'], 'size': [2, 2], 'dimension': {'geo': {'category': {'index': {'BG': 0, 'EU': 1}}}, 'time': {'category': {'index': ['2024', '2025']}}}, 'value': [1, None, 3, 4], 'status': {'2': 'p'}}
write('jsonstat.json', {'cells': data_io.jsonstat_cells(js), 'series': data_io.jsonstat_series(js, 'time', {'geo': 'EU'})})
write('metadata.json', [data_io.meta('id', 'Заглавие'), data_io.meta('x', 'title', status='mock', source=['asbp'], source_note='note', as_of='2026-01-02', unit='€', custom=3)])
write('provenance.json', {'baseline': '851e90f', 'buildDate': '2026-11-08', 'sourceArchiveSha256': '5f8e6a98b05919dc776fb68f40615a544b585e1a1690e29cf2f6f3b0e0648701', 'originalTableSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'fixtureSha256': hashlib.sha256((HERE/'asbp-tables.json').read_bytes()).hexdigest(), 'oracle': 'Python 3.12: forecast_tables, data_io, cli.registry_inputs, execution_contract.numbers and yaml.safe_load'})
