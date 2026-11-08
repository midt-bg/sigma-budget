"""Acquire all registered automatic sources into a separate snapshot; never update pins."""
import datetime
import json
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse


def collect(root, out, seed, fetch, kind_ok, sha256_file, sha256_bytes, yaml_load):
    from budget_pipeline.sources import boundaries

    root, out, seed = map(Path, (root, out, seed))
    if out.resolve() == root.resolve() or out.resolve() == seed.resolve():
        raise ValueError("collect output must be separate from the checkout and seed")
    if any(out.resolve().is_relative_to((seed / folder).resolve()) for folder in ("data/originals", "data/cache")):
        raise ValueError("collect output cannot be inside the seed input directories")
    out.mkdir(parents=True, exist_ok=True)
    # Manual originals and historical live snapshots come from the release inputs.
    for folder in ("data/originals", "data/cache"):
        if (seed / folder).exists():
            for source_file in (seed / folder).rglob("*"):
                if source_file.is_file():
                    destination = out / source_file.relative_to(seed)
                    if not destination.exists():
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(source_file, destination)
    registry = yaml_load(root / "data/sources.yaml")
    pin_file = root / "data/originals.sha256"
    pins = dict(line.split("  ", 1)[::-1] for line in (pin_file.read_text() if pin_file.exists() else "").splitlines() if "  " in line)
    rows = []
    old_gisco, old_eurostat = boundaries.GISCO_CACHE, boundaries.EUROSTAT_CACHE
    scratch = tempfile.TemporaryDirectory(prefix="budget-collect-")
    temporary = Path(scratch.name)
    try:
        boundaries.GISCO_CACHE = temporary / "data/cache/gisco_lau_bg.json"
        boundaries.EUROSTAT_CACHE = temporary / "data/cache/eurostat_pop_nuts3_bg.json"
        for source in registry["sources"]:
            if source["acquisition"] not in ("auto", "fetch", "fetch-bg"):
                continue
            for entry in source["files"]:
                rel, url = entry["path"], entry.get("url")
                if "*" in rel:
                    raise ValueError("automatic source requires an exact path: " + rel)
                row = {"source": source["id"], "path": rel, "url": url, "expected": pins.get(rel, entry.get("sha256"))}
                target = out / rel
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
                        blob = (temporary / rel).read_bytes()
                    else:
                        blob = fetch(url, timeout=30, tries=1)
                        if not kind_ok(rel, blob):
                            raise ValueError("unexpected file format")
                        if Path(rel).suffix in (".json", ".jsonld"):
                            json.loads(blob)
                    if target.exists() and sha256_file(target) != sha256_bytes(blob):
                        target = target.with_name(target.name + "." + sha256_bytes(blob)[:12])
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(blob)
                    digest = sha256_file(target)
                    expected = pins.get(rel, entry.get("sha256"))
                    row.update(status="ok", file=target.relative_to(out).as_posix(), sha256=digest, expected=expected,
                               retrieved=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                               drift="same" if digest == expected else "changed" if expected else "un-pinned")
                except Exception as exc:
                    row.update(status="unavailable", error=str(exc))
                rows.append(row)
                (out / "snapshot.json").write_text(json.dumps({"collected": rows}, ensure_ascii=False, indent=1) + "\n")
                print("collect: %s: %s" % (rel, row.get("drift", row["status"])), flush=True)
    finally:
        scratch.cleanup()
        boundaries.GISCO_CACHE, boundaries.EUROSTAT_CACHE = old_gisco, old_eurostat
    (out / "snapshot.json").write_text(json.dumps({"collected": rows}, ensure_ascii=False, indent=1) + "\n")
    return rows
