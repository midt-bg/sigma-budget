"""The remaining groups of base.py, one module each: DEBT, MUNIC + SEBRA, COMPONENTS + RATES, SEARCH + FEED, REBUILD + MOCK (child processes)."""


import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[3] / "pipeline"))
ROOT = _Path(__file__).resolve().parents[3]
import budget_pipeline.validate.vd_comp as vd_comp
import budget_pipeline.validate.vd_debt as vd_debt
import budget_pipeline.validate.vd_idx as vd_idx
import budget_pipeline.validate.vd_local as vd_local
import budget_pipeline.validate.vd_run as vd_run

GROUPS = tuple(vd_debt.GROUPS) + tuple(vd_local.GROUPS) + tuple(vd_comp.GROUPS) + tuple(vd_idx.GROUPS) + tuple(vd_run.GROUPS)
