# BUDGET2027 validation evidence

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; the retained data, checksums and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

The input inventory pins the 8b68ae1 source revision and 2026-11-08 date.
The historical Python 3.12 donor closure was copied at that revision. The manual-cell transcription is
stored here; the tracked fiscal ZIP and extraction JSON and the wave13a
published projections are reused by their listed SHA-256 values. These paths
were the complete offline closure for the generator. It rejected changed inputs
and network access; it did not read the working release, caches or originals.

`generate_oracle.py` compared the full check count, problems, warnings
and facts for the pinned publication and output mutations. For the output-only
mutations it computed the donor projections once and reused them, while the
unchanged group and oracle checks run on each mutated publication. A separate
case changes the forecast extraction and rebuilds the annual, bill and lineage
outputs together. The two independent PDF failures in that case show that
agreement between a source and its derived output is insufficient.

`audit_pdf.py` opened the pinned ZIP members and checked the presence of
both the transcribed label and printed number on each referenced page. This is
new page-level text evidence, not a new table geometry or column extraction.
Earlier physical-cell audits and their limitations remain as documented in the
fiscal and wave13a fixtures. The other historical source gaps remain open.

# Combined source metadata failures

The supplemental source_order.py generator preserves the original inventory,
donor and observations. It captures 16 combined-damage cases using the unchanged
Python 3.12 validator. Required archive/member fields are read before archive I/O
and checksum verification, for both documents. Direct and compiled CLI tests
compare full group crash results, including counts, diagnostics and exit status.
The historical module is recorded in the fixture origin index.

The separate source_methods.py capture adds 66 complete donor outcomes for
ZIP-member lookup before hash comparison, unhashable member names, missing or
null member hashes, and raw float/exponent source containers. Direct and compiled
CLI comparisons preserve the exception type, first failure, counts and facts.
It leaves all previous captures unchanged. The historical module is recorded in the fixture origin index.

`optional_values.py` captured six complete donor outcomes for the optional
EU-contribution fallback. Empty lists, empty mappings, null, false, zero and empty
text all select the donor's zero fallback. Direct and compiled tests preserve
all 20,986 checks, with original numeric source tokens retained in the inputs.

`fixture-history.test.ts` authenticates `pdf-audit.json`, `source-order-provenance.json`, `source-methods-provenance.json` and `optional-values-provenance.json` with fixed hashes. It verifies their JSON dependencies from actual bytes and their deleted generators, including `sourceOrderSha256`, against the pinned history; no PDF is re-extracted.
