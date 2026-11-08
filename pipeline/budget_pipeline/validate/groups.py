"""The remaining groups of base.py, one module each: DEBT, MUNIC + SEBRA, COMPONENTS + RATES, SEARCH + FEED, REBUILD + MOCK (child processes)."""


import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[3] / "pipeline"))
ROOT = _Path(__file__).resolve().parents[3]
import budget_pipeline.validate.components as components
import budget_pipeline.validate.debt as debt
import budget_pipeline.validate.search_feed as search_feed
import budget_pipeline.validate.local_finance as local_finance
import budget_pipeline.validate.subprocess_groups as subprocess_groups

GROUPS = tuple(debt.GROUPS) + tuple(local_finance.GROUPS) + tuple(components.GROUPS) + tuple(search_feed.GROUPS) + tuple(subprocess_groups.GROUPS)
