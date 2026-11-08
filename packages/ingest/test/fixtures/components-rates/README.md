# Components and rates evidence

The frozen inputs were captured at `bd973a0a3dfbc8d8bd03ac85e6aa1f0784669bf2` on 2026-11-08. `capture-source-hashes.json` records every file used for capture; the inputs and outputs have separate hashes in `provenance.json`. The raw law blocks, NAP contribution rows, and bill grid are the results of the unchanged Python readers. The remaining files are the context consumed by the components builder. The July component summary's original source is unknown and is retained as a frozen limitation.

`generate_oracle.py --check` calls the unchanged Python builders with only this evidence. It checks byte-for-byte regeneration, including the two intermediate transformations, without reading the live data tree. To repeat the initial capture, restore the documented archive in a disposable worktree and run `capture.py` with Python 3.12 and the locked dependencies. It verifies all source hashes before reading them. Capture is a manual offline operation, not a CI step.

The TypeScript work here covers only the state-budget transformation and the minimum-income and ТЗПБ annex transformations. It does not yet build either final JSON file or establish end-to-end parity.
