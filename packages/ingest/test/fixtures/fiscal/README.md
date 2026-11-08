# Fiscal evidence (partial)

This fixture covers only Table VI-1, the state debt helper in `fiscal.py`. It does
not provide the four fiscal dataset builders or establish dataset parity.
`vi-1-input.json` is the VI-1 table from the named source file in the pinned
complete119 archive. The source file, archive, fixture and Python output hashes
are in `provenance.json`. The helper reads the frozen table only; it does not
read the current release or consult the network.

Regenerate or verify the independent Python output with Python 3.12:

```sh
PYTHONPATH=pipeline python3.12 packages/ingest/test/fixtures/fiscal/generate_oracle.py --check
```

The remaining fiscal builders, cleaned debt prose, annual-period layer, source
inputs and published wording still need their own evidence and parity checks.
