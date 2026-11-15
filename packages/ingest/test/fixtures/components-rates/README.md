# Components and rates evidence

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; JSON, CSV, XML, hashes and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

The frozen inputs were captured at `bd973a0a3dfbc8d8bd03ac85e6aa1f0784669bf2` on 2026-11-08. `inputs/capture-source-hashes.json` records every file used for capture; the inputs and outputs have separate hashes in `provenance.json`. The raw law blocks, NAP contribution rows, and bill grid are results of the unchanged Python readers. The other files are the context consumed by the components builder. The July component summary's original source is unknown and remains a frozen limitation.

`generate_oracle.py` invoked the unchanged Python builders with only this evidence and checked byte-for-byte regeneration, without reading the live data tree. The original capture was a manual offline operation with Python 3.12 and locked dependencies.

The scoped tests compare both complete TypeScript outputs with the frozen Python outputs, with exact numeric comparison and no accepted differences. `pnpm components-rates:compare-live` separately compares the candidate against the current release; it is a local diagnostic and is not a frozen CI test. The test-only builder writes only under `tmp/ts-migration/candidates/06`.
