# SEARCH route-catalogue evidence

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; the retained data, checksums and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

`routes/generate.py` recorded eleven complete outcomes from the unchanged
Python SEARCH validator and route loader. The cases cover seven/eight-field
records and malformed lengths, duplicate IDs after options expansion, valid
options, absent options, empty catalogues and BOM bytes. Direct and compiled
SEARCH tests compare the whole group in raw and accepted modes.

This supplement depends on the shared loader correction in PR35. It preserves
the original 65 SEARCH observations, source-boundary supplement, corpus and all
eleven original evidence pins. The hash-pinned parent README remains byte-identical; current documentation is in its companion README-frozen-data.md.
