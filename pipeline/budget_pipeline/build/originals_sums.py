#!/usr/bin/env python3
"""originals_sums.py - refresh data/originals.sha256 after the published prototype/ files changed (pure standard library).

  python3 pipeline/budget_pipeline/build/originals_sums.py            rewrite the entries of the files that are in the repository
  python3 pipeline/budget_pipeline/build/originals_sums.py --check    write nothing; exit 1 when an entry is stale

The manifest also lists the raw files of data/originals (not in the repository, see docs/data-sources.md): their entries are kept as they are.
"""

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[3] / "pipeline"))
ROOT = _Path(__file__).resolve().parents[3]
import hashlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = str(__import__("pathlib").Path(__file__).resolve().parents[3])              # repository root
MANIFEST = os.path.join(ROOT, "data", "originals.sha256")
RAW_PREFIX = "data/originals/"


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    check = "--check" in sys.argv
    lines, stale = [], 0
    with open(MANIFEST, "r", encoding="utf-8") as fh:
        for ln in fh.read().splitlines():
            if not ln.strip():
                continue
            h, _, rel = ln.partition("  ")
            path = os.path.join(ROOT, rel)
            if not rel.startswith(RAW_PREFIX) and os.path.exists(path) and sha(path) != h:
                h = sha(path)
                stale += 1
            lines.append("%s  %s" % (h, rel))
    if check:
        print("%d stale entries" % stale)
        return 1 if stale else 0
    with open(MANIFEST, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")
    print("%d entries refreshed, %d in all" % (stale, len(lines)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
