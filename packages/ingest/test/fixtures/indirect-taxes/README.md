# Indirect-tax reader evidence

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; the retained data, checksums and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

The historical `capture.py` checked the six originals after checking the pinned input archive and each source SHA-256. `reader-ir.json` retains named-sheet cells, HTML parser text, PDF page text and DOCX table cells, before interpreting rates, dates, products, years or conversions. `donor.py` and `data_io_donor.py` were unchanged Python 3.12 baseline sources. `regenerate.py` substituted only the reader interfaces and verified the independent donor output from the committed IR without reading the archive or release data. `provenance.json` pins all fixture bytes. This does not claim that the raw-reader adapters have been ported to TypeScript.
