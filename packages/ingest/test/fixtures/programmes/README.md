# Budget and programme fixtures

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; JSON, CSV, XML, hashes and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

The frozen inputs consist of the programme extraction and law cache at
`e2954c9`, plus resolved cells, PDF headings and row labels from the independent
Python `program_budget_pdf` reader. `capture_pdf.py` read all 46 pinned PDFs,
checks each against `data/originals.sha256`, and recorded their hashes and parsed
evidence. The archive used to restore them is identified by SHA-256 in
`provenance.json`. The PDF reader remains in Python.

`generate_oracle.py` invoked the unchanged Python normalization and budget
builders against these frozen inputs. It never read live repository datasets or
originals. The outputs are now frozen data.

The historical generator also recorded Python expectations for a null source year cell and
Unicode word boundaries in names. The required tests compare all 44 scoped
files, including the null-cell case, with the Python oracle, verify
input and oracle hashes, and exercise damaged inputs. There are no accepted
differences. The current published release can be compared separately:

```sh
pnpm --filter @sigma-budget/etl... build
pnpm exec budget-ts build --inputs packages/ingest/test/fixtures/programmes --out tmp/ts-migration/candidates/05 --scope ministries,ministries-programs,programs --build-date 2026-11-08
pnpm exec budget-ts parity --oracle data/release --candidate tmp/ts-migration/candidates/05/data --scope ministries,ministries-programs,programs --policy packages/ingest/test/fixtures/programmes/policy.json --report tmp/ts-migration/candidates/05/live-diff.json
```
