# Supplemental dictionary and tuple regressions

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; the retained data, checksums and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

This corpus preserves all original 1,366 case definitions, 1,372 observations,
64 input pins, donor bytes and historical mutation files unchanged.
The historical unchanged Python 3.12 donor generated the new complete group observations
and raw mutation preimages. Baseline controls cover all seven groups.

The historical generator ran separate interpreters with PYTHONHASHSEED 0 through 7.
Python set iteration may change the orientation of a TypeError during sorting
heterogeneous tuples. Each distinct complete observed result is stored with
its producing seeds. Tests require an exact match with one of those complete
results, including exception type/message, counts, diagnostics, facts and exit
status. They do not normalize wording or accept arbitrary errors. Historical
single-observation tests keep their original exact comparisons.

The additional 225 native Python vectors test structural tuple dictionary keys,
bool/integer equality, raw float representations, unhashable components and
Unicode ordering independently of the port. Provenance pins the new definitions,
generator, observations and mutation bytes together with the original generator,
cases, observations and provenance. This is offline validation parity, not reconstruction of
missing original source files or completed production migration.
