"""Acquire all registered automatic sources into a separate snapshot; never update pins."""
import json
import shutil
from pathlib import Path
from urllib.parse import urlparse


def collect(root, out, seed, fetch, kind_ok, sha256_file, sha256_bytes, yaml_load):
    from budget_pipeline.sources import boundaries

    root, out, seed = map(Path, (root, out, seed))
    if out.resolve() == root.resolve() or out.resolve() == seed.resolve():
        raise ValueError("collect output must be separate from the checkout and seed")
    if out.exists() and any(out.iterdir()):
        raise ValueError("collect output must be empty (snapshots are immutable)")
    out.mkdir(parents=True, exist_ok=True)
    # Manual originals and historical live snapshots come from the release inputs.
    for folder in ("data/originals", "data/cache"):
        if (seed / folder).exists():
            shutil.copytree(seed / folder, out / folder, dirs_exist_ok=True)
    registry = yaml_load(root / "data/sources.yaml")
    pins = dict(line.split("  ", 1)[::-1] for line in (root / "data/originals.sha256").read_text().splitlines() if "  " in line)
    rows = []
    old_gisco, old_eurostat = boundaries.GISCO_CACHE, boundaries.EUROSTAT_CACHE
    try:
        boundaries.GISCO_CACHE = out / "data/cache/gisco_lau_bg.json"
        boundaries.EUROSTAT_CACHE = out / "data/cache/eurostat_pop_nuts3_bg.json"
        for source in registry["sources"]:
            if source["acquisition"] not in ("auto", "fetch", "fetch-bg"):
                continue
            for entry in source["files"]:
                rel, url = entry["path"], entry.get("url")
                if "*" in rel:
                    raise ValueError("automatic source requires an exact path: " + rel)
                row = {"source": source["id"], "path": rel, "url": url, "expected": pins.get(rel, entry.get("sha256"))}
                target = out / rel
                # A failed refresh must not leave an old seed looking freshly acquired.
                target.unlink(missing_ok=True)
                try:
                    if not url or urlparse(url).hostname in ("minfin.bg", "www.minfin.bg"):
                        raise ValueError("automatic URL missing or browser-only host")
                    if entry.get("via"):
                        if rel == "data/cache/gisco_lau_bg.json":
                            boundaries.boundaries(True)
                        elif rel == "data/cache/eurostat_pop_nuts3_bg.json":
                            boundaries.fetch_eurostat(True)
                        else:
                            raise ValueError("unknown acquisition reducer: " + rel)
                    else:
                        blob = fetch(url, timeout=30, tries=1)
                        if not kind_ok(rel, blob):
                            raise ValueError("unexpected file format")
                        if Path(rel).suffix in (".json", ".jsonld"):
                            json.loads(blob)
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(blob)
                    digest = sha256_file(target)
                    expected = pins.get(rel, entry.get("sha256"))
                    row.update(status="ok", sha256=digest, expected=expected,
                               drift="same" if digest == expected else "changed" if expected else "un-pinned")
                except Exception as exc:
                    target.unlink(missing_ok=True)
                    row.update(status="unavailable", error=str(exc))
                rows.append(row)
    finally:
        boundaries.GISCO_CACHE, boundaries.EUROSTAT_CACHE = old_gisco, old_eurostat
    (out / "snapshot.json").write_text(json.dumps({"collected": rows}, ensure_ascii=False, indent=1) + "\n")
    return rows
