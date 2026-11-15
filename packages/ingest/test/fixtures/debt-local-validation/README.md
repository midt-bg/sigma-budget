# Independent validation donor corpus

This directory contains frozen DATA fixtures. Python generators and donor copies have been removed; JSON, CSV, XML, hashes and oracle outputs are preserved byte for byte. TypeScript tests continue to compare against these expectations.

The historical module paths, SHA-256 values and Git revisions are recorded in the [fixture origin index](../../README-fixtures.md). Existing provenance inventories retain their historical Python entries; they are not a current checkout file list.

This new corpus freezes the complete DEBT/MUNIC/SEBRA validation donors and six
input files from each named published/candidate baseline. Existing builder
fixtures are preserved. See the [API and scope notes](../../../src/validate/debt-local/README.md)
for exact commits, dates, counts, limits and source-evidence integration.

The historical Python 3.12 capture is frozen. The historical generator verified the
frozen pin inventory and reproduces all 95 finite scenarios with no production
builder, network call or TypeScript dependency. The imported frozen modules
retain their original bytes; the small harness supplies the six datasets and
the explicit baseline build date.

`provenance.json` pins donors, cases, oracle, generator and both sets of
snapshots. It also records available existing BNB/SEBRA original byte hashes;
that inventory does not claim those original files have been parsed by these
validation rules. No snapshot is described as a new acquisition.
