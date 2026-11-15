# Additional acceptance regressions

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; JSON, CSV, XML, hashes and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

This independent Python 3.12 corpus supplements the original 37-case capture and
the 55-case overlay. It does not replace either capture or edit the frozen donor.
The historical generator loaded the original pinned donor closure and captured complete
CORE/CATALOG observations for raw integer, float and exponent tokens, boolean
controls, and dictionary-key types. JSON decoder observations come directly from
Python's JSON decoder with the production non-finite-constant callback.

The provenance pins the new cases, generator and observations, plus the original
generator, cases, observations and provenance. The original generator independently
checks all 106 frozen input hashes. No current release, cache or network reads are
used. The results are now frozen data.

The CLI regressions independently verify that rejected path declarations prevent
report writes, including traversal and symlink aliases, existing sentinel inputs,
and absent output directories. Console-only failure diagnostics remain available.
These tests establish validator and input-preservation behavior, not recovery of
the missing historical originals.
