# RSS donor evidence (partial Wave 11)

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; JSON, CSV, XML, hashes and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

`donor/feed.py` was the unchanged donor from commit `10697d0def6ff6892029a311e2b590602e66b931` (SHA-256 `2e3a11cc4aa4424470141ba027172b5fda9910f8de8431da054a8e89466e66ed`). `cases.json` is a synthetic input, not a publication or a source reconstruction. The historical generator loaded only the RSS functions from that donor, with unrelated pipeline imports stubbed and a fixed build date. Its Python 3.12 `xml.etree.ElementTree` comparison independently checked parsed XML as well as exact bytes. The capture is retained as frozen data.

This evidence covers RSS serialization only. It does not establish feed event construction, aggregation, final-layer or published-release parity.
