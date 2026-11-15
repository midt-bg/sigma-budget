# Source keys and nonblank text

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; the retained data, checksums and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

This supplemental Python 3.12 capture preserves the original 37 cases, 55 overlay
cases and 22 prior review cases and their observations byte for byte. It records
complete CORE/CATALOG results for nested unhashable source keys, scalar keys,
mapping/string iteration controls and Python whitespace/non-whitespace text.
All original donor/corpus bytes are checked by the original generator prefix;
new provenance additionally pins this generator, its cases and all prior proofs.

The compiled CLI replay checks raw group results and the existing exact baseline
exceptions. Registry report tests independently preserve sentinel inputs for
rejected declarations, globs, aliases, unvisited later declarations and incomplete
registries. Ordinary unrelated failure reports remain allowed. A failed or partial
inventory cannot authorize a report write.

These observations
prove validator behavior against frozen inputs, not historical source acquisition.
