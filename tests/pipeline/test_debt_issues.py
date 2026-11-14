import unittest
import json
from pathlib import Path
from copy import deepcopy
from budget_pipeline.validate.debt_issues import valid_debt_issues

class DebtIssuesContract(unittest.TestCase):
    def test_snapshot_and_rejections(self):
        doc=json.loads((Path(__file__).resolve().parents[2]/'data/release/debt-issues.json').read_text())
        self.assertTrue(valid_debt_issues(doc))
        for name in ('meta','schema','sourceSha256','sourceUrl','domestic','external','auctions','maturity','stock','differences','limitations','validation'):
            d=deepcopy(doc);del d[name];self.assertFalse(valid_debt_issues(d),name)
        for change in [lambda d:d['domestic'].pop(),lambda d:d['external'].pop(),lambda d:d['auctions'].pop(),lambda d:d['domestic'][0].update(isin='invalid'),lambda d:d['external'][0].update(isins=[]),lambda d:d['auctions'][0].update(approved=10**15),lambda d:d['maturity'][0].update(originalTenths=0),lambda d:d['external'][0].update(currency='BGN'),lambda d:d['domestic'][0].update(maturity='2000-01-01'),lambda d:d['external'][0].update(nominal=None)]:
            d=deepcopy(doc);change(d);self.assertFalse(valid_debt_issues(d))
