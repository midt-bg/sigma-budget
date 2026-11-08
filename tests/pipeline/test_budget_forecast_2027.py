"""Pinned-PDF integration, parsing and fail-closed mutation tests."""
import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from budget_pipeline.extract import budget_forecast_2027 as extract
SCRIPT = extract.__file__


class ExtractForecast(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.path = Path(cls.temporary.name) / 'first.json'
        result = subprocess.run([__import__('sys').executable, str(SCRIPT), '--output', str(cls.path)], capture_output=True)
        if result.returncode != 0 or not cls.path.exists():
            raise AssertionError(result.stderr.decode())
        cls.bytes = cls.path.read_bytes()
        cls.output = json.loads(cls.bytes)

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_reproduce_and_fail_closed_on_source_conflict(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'forecast.json'
            result = subprocess.run([__import__('sys').executable, str(SCRIPT), '--output', str(output)], capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr.decode())
            self.assertEqual(output.read_bytes(), self.bytes)

    def test_discrepancies_remain_explicit(self):
        self.assertFalse([c for c in self.output['checks'] if not c['passed']])
        self.assertTrue(self.output['diagnostics'])
        self.assertTrue(all(c['pages'] for c in self.output['diagnostics']))

    def test_wrapped_function_number_and_label(self):
        row = self.output['tables']['III_1']['rows'][12]
        self.assertEqual(row['values'][1], 20394.3)
        self.assertEqual(row['printed'][1], '20 394,3')
        self.assertEqual(row['label'], 'Социално осигуряване, подпомагане и грижи')

    def test_mutation_breaks_accounting_and_duplicate_checks(self):
        tables = copy.deepcopy(self.output['tables'])
        tables['II_1']['rows'][0]['values'][2] += 10
        failed = [c['name'] for c in extract.validate(tables) if not c['passed']]
        self.assertIn('II_1 revenue-expenditure 2027', failed)
        self.assertIn('II_1 vs annex3_mln row 0', failed)
        self.assertIn('II_1 sum 0/2', failed)

    def test_known_gdp_exception_is_exact(self):
        tables=copy.deepcopy(self.output['tables'])
        tables['I_2']['rows'][0]['values'][1]+=1
        failures=[c for c in extract.validate(tables) if not c['passed']]
        self.assertTrue(any(c['name']=='GDP I-2 vs Annex3 2025 known discrepancy' for c in failures))

    def test_annex2_dated_rates_and_continuations(self):
        rows=self.output['tables']['annex2']['rows']
        self.assertEqual(len(rows),100)
        liquid=next(r for r in rows if r['label'].startswith('Акциз на течност'))
        self.assertEqual(liquid['printed'][0],'0,25 (от 1 януари 2026 г.) / 0,28 (от 1 август 2026 г.)')
        self.assertEqual(liquid['printed'][1],'0,31 (от 1 март 2027 г.)')
        pension=next(r for r in rows if r['page']==185 and 'професионални пенсионни фондове' in r['label'])
        self.assertIn('7 на сто',pension['printed'][0])
        self.assertEqual(pension['continuation_pages'],[186])
        verification=self.output['independent_verification']
        self.assertEqual(verification['matched'],42)
        self.assertGreaterEqual(verification['annex2_fragment_cells_matched'],400)
        self.assertEqual(verification['mismatches'],0)

    def test_damaged_annex2_cell_fails(self):
        tables=copy.deepcopy(self.output['tables'])
        tables['annex2']['rows'][0]['printed'][0]='21'
        self.assertTrue(any(not c['passed'] and c['name']=='Annex2 fragment alignment 0/0' for c in extract.validate(tables)))

    def test_missing_row_fails(self):
        tables=copy.deepcopy(self.output['tables'])
        tables['annex4']['rows'].pop()
        self.assertTrue(any(not c['passed'] and c['name']=='annex4 shape' for c in extract.validate(tables)))

    def test_numeric_conversion(self):
        self.assertEqual(extract.number('− 3 492,2'), -3492.2)
        self.assertEqual(extract.number('37,8%'), 37.8)
        self.assertIsNone(extract.number('15 (от 1 януари 2026 г.)'))


if __name__ == '__main__':
    unittest.main()
