"""Acquisition coverage, immutable snapshots and offline enforcement."""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from budget_pipeline import cli
from budget_pipeline.sources.collect import collect
from budget_pipeline.validate.registry import gaps


class ReproducibilityTests(unittest.TestCase):
    def test_described_inputs_are_explicit_leaves(self):
        ds = [{"id": "test", "status": "real", "inputs": ["text", "number"]}]
        inter = [{"path": "text", "category": "described-input", "reproducible": False},
                 {"path": "number", "reproducible": False}]
        self.assertEqual(gaps(ds, inter), {"test": ["number"]})

    def test_offline_rejects_socket(self):
        from budget_pipeline.offline import deny_network
        for event in ("socket.connect", "socket.getaddrinfo", "socket.bind"):
            with self.assertRaises(RuntimeError):
                deny_network(event, ())

    def test_collect_includes_fetch_and_reducers_and_preserves_pins(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "data").mkdir()
            path = "data/originals/sample.json"
            digest = hashlib.sha256(b'{}').hexdigest()
            (root / "data/originals.sha256").write_text(digest + "  " + path + "\n")
            reg = {"sources": [{"id": "s", "acquisition": "fetch", "files": [
                {"path": path, "url": "https://example.org/file"},
                {"path": "data/cache/eurostat_pop_nuts3_bg.json", "url": "https://example.org/pop",
                 "via": "reducer", "sha256": digest}]}]}
            def reducer(refresh):
                from budget_pipeline.sources import boundaries
                boundaries.EUROSTAT_CACHE.parent.mkdir(parents=True, exist_ok=True)
                boundaries.EUROSTAT_CACHE.write_bytes(b'{}')
            with patch('budget_pipeline.sources.boundaries.fetch_eurostat', reducer):
                rows = collect(root, root / "out", root, lambda *a, **k: b'{}', cli.kind_ok,
                               cli.sha256_file, cli.sha256_bytes, lambda p: reg)
            self.assertEqual([r['drift'] for r in rows], ['same', 'same'])
            self.assertEqual((root / "data/originals.sha256").read_text(), digest + "  " + path + "\n")
            with self.assertRaises(ValueError):
                collect(root, root / "out", root, None, None, None, None, None)

    def test_failed_acquisition_does_not_retain_seed(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            target = root / "data/originals/sample.json"
            target.parent.mkdir(parents=True)
            target.write_bytes(b'{}')
            (root / "data/originals.sha256").write_text("")
            reg = {"sources": [{"id": "s", "acquisition": "fetch", "files": [
                {"path": "data/originals/sample.json", "url": "https://example.org/file"}]}]}
            rows = collect(root, root / "out", root, lambda *a, **k: b'not json', cli.kind_ok,
                           cli.sha256_file, cli.sha256_bytes, lambda p: reg)
            self.assertEqual(rows[0]['status'], 'unavailable')
            self.assertFalse((root / "out/data/originals/sample.json").exists())
            self.assertEqual(target.read_bytes(), b'{}')
