#!/usr/bin/env python3
"""rebuild.py - rebuild data/release of the current site (v6) from the raw inputs: the donor builders, then the v5/v6 layer.

The files of data/release are not the plain output of datasets.py: v5 renamed «реални данни» to «официални данни», took СЕБРА and the
generated sets out of the active layer, and v6 added the sources of the screen S34. Run alone, datasets.py writes the donor (v1)
form and removes all of that. This script runs the steps in the order that gives the published files:

  1. kfp_full.py          data/release/execution.json from data/originals/kfp_*/
  2. datasets.py                every other dataset of the builders (core.json last)
  3. wording.py                the v3/v4 wording on catalog.json, core.json and search-index.json (pairs from the tags mock-v2, mock-v4)
  4. active_data.py site       СЕБРА and the generated sets out of catalog, feed, search-index and core
  5. apply_sources.py             the four sources of S34 and counts.terms in core.json (the rest of the glue is already in site/)
  6. catalog_refresh.py        sizes, schemas, screens and counts of catalog.json against the files

Checked on 2026-11-05: with the inputs of the published site (the August 2026 report) the result equals data/release byte for byte, apart

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[3] / "pipeline"))
ROOT = _Path(__file__).resolve().parents[3]
from the files whose inputs changed since (parliament API, Eurostat, BNB, the access probes) and gzipBytes in catalog.json, which depend
on the zlib of the machine.

  tmp/venv-data/bin/python pipeline/budget_pipeline/build/rebuild.py --build-date 2026-11-05     the build date goes into meta.retrieved of every file
  tmp/venv-data/bin/python pipeline/budget_pipeline/build/rebuild.py                             BUILD_DATE from the environment, else the default of data_io.py

Writes data/release/ and tmp/versions/site-v2|site-v4/data/ (the wording pairs). Glossary, guide and the mock sets are not rebuilt
(editorial.py, examples.py). Stops at the first failing step.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
T = "pipeline/budget_pipeline/build/"
WORDING_FILES = ["catalog.json", "core.json", "search-index.json"]


def run(args, env):
    print("== " + " ".join(args), flush=True)
    rc = subprocess.run([sys.executable] + args, cwd=str(ROOT), env=env).returncode
    if rc:
        sys.exit("rebuild: failed (exit %d): %s" % (rc, " ".join(args)))


def tag_files(env):
    """The wording pairs of wording.py come from the data of the tags mock-v2 (old wording) and mock-v4 (new wording)."""
    for tag in ("v2", "v4"):
        out = ROOT / "tmp" / "versions" / ("site-" + tag) / "data"
        out.mkdir(parents=True, exist_ok=True)
        for f in WORDING_FILES:
            data = subprocess.run(["git", "show", "mock-%s:%s/%s" % (tag, "site" + "/data", f)], cwd=str(ROOT), capture_output=True, env=env)
            if data.returncode:
                sys.exit("rebuild: no mock-%s:%s/%s (git fetch --tags)" % (tag, f))
            (out / f).write_bytes(data.stdout)


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--build-date", help="YYYY-MM-DD for meta.retrieved and build.dataVersion (else BUILD_DATE or the data_io.py default)")
    ap.add_argument("--versions-ready", action="store_true",
                    help="tmp/versions/site-v2|v4/data are already in place (pipeline/budget_pipeline/cli.py writes them from the tags before a build without git)")
    args = ap.parse_args(argv)
    env = dict(os.environ)
    if args.build_date:
        env["BUILD_DATE"] = args.build_date
    if args.versions_ready:
        missing = [str(p) for t in ("v2", "v4") for f in WORDING_FILES
                   for p in [ROOT / "tmp" / "versions" / ("site-" + t) / "data" / f] if not p.is_file()]
        if missing:
            sys.exit("rebuild: --versions-ready, but missing: " + ", ".join(missing))
    else:
        tag_files(env)
    run(["pipeline/budget_pipeline/extract/kfp_full.py"], env)
    run([T + "datasets.py"], env)
    for f in WORDING_FILES:
        run([T + "wording.py", f, "data/release"], env)
    run([T + "active_data.py", "data/release", "--apply"], env)
    run([T + "apply_sources.py"], env)
    run([T + "catalog_refresh.py"], env)
    print("rebuild: done; check with datasets.py and review `git diff --stat data/release`")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
