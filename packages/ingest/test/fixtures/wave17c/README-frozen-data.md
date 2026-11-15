# SEARCH validation evidence

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; the retained data, checksums and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

The corpus contains unchanged Git blobs from `e4168b09df77d3f48cb3be38c52b173d5887f7fe`, with build date 2026-11-08. The inventory records every included byte count and SHA-256. Its historical inventory includes the Python package closure for the actual base and `datasets` wrappers, the route table, and only the JSON datasets needed by SEARCH and wrapper startup. The capture used no live release directory, cache, network or TypeScript output. `check_provenance.py` additionally compared the corpus with its named Git blobs. The four generators and their captured evidence are pinned by `evidence.json`.

`wrapper.json` preserves base, default and `--no-accepted` wrapper outcomes. SEARCH has no accepted exception. `differential.json` records the complete ordered result or crash for each mutation, while `reference.json` captures independent engine cases. The Unicode tables are generated from CPython 3.12's Unicode 15.0.0 database. The `billMc` mutation documents a donor limitation: this SEARCH group uses `budgets.bill` and does not inspect `billMc`. Historical raw originals are not included and acquisition parity is not claimed.
