# Independent-rule frozen inputs

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; the retained data, checksums and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

The baseline is `3424bc998c726d6d511d4284295c54c50c42d099`, as recorded in `manifest.json`.

`inputs/` captures the four mutable repository inputs from that commit: `data/originals.sha256`, `data/inputs/indirect_tax_evidence.json`, `data/inputs/budget_forecast_2027.json` and `data/inputs/budget_bill_2027.json`. Their bytes are authenticated by the existing, unchanged `requiredInputs` hashes. They are copied into each owned test root; live checkout changes are not historical evidence.

The immutable raw original dependencies still come from the read-only `--repo` checkout and are authenticated against their recorded content hashes. The captured list is not used to validate current live editorial pins; production validation remains responsible for those.

The Python 3.12 capture is frozen; the historical generator and its pinned dependencies are available through Git history. Neither the manifest hashes, the donor, the cases nor the existing oracle have been changed for this capture.
