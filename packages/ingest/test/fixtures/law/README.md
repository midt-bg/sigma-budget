# Law builder fixtures

The input is the release-build archive pinned in `provenance.json` at revision
`1843be0`, plus `data/release/ministries.json`. Extract that archive into
`tmp/ts-law-inputs/` and run:

```sh
PYTHONPATH=pipeline tmp/venv-data/bin/python packages/ingest/test/fixtures/law/generate_oracle.py
```

The generator verifies the archive and extracted input hashes, records Python's
`budget_law_parser.dv_blocks` output and the fields used from the Parliament
responses, and builds the independent expected results with Python `law.py`.
The cached Parliament proposals in this release already contain decoded arrays.
`literal-data.json` additionally records representative Python `ast.literal_eval`
results; TypeScript accepts decoded data and does not evaluate Python literals.
The optional Parliament ZIP was absent from the archive, so its size check is
not exercised by this fixture. The 2027 wording has its own fixture so its later tracking change remains
isolated. The raw legal parsers remain in Python.

Build and compare the TypeScript candidate:

```sh
pnpm --filter @sigma-budget/etl... build
pnpm exec budget-ts build --inputs packages/ingest/test/fixtures/law --out tmp/ts-migration/candidates/04 --scope law --build-date 2026-11-08
pnpm exec budget-ts parity --oracle data/release --candidate tmp/ts-migration/candidates/04/data --scope law --policy packages/ingest/test/fixtures/law/policy.json --report tmp/ts-migration/candidates/04/diff.json
```
