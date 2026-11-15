# Frozen fixture origins

All 314 Python files removed from `test/fixtures/` are recorded in [python-fixture-history.json](python-fixture-history.json). Paths are relative to `test/fixtures/`; each entry preserves SHA-256 and `lastChangedCommit` from `git log -1 -- <path>`. `lastPresentCommit` is the parent checkout in which every listed file still existed. These are source-history facts, not a claim that the last edit itself executed a capture. Existing family provenance retains the actual donor baseline, capture environment, input hashes and limitations.

The hash-pinned `catalog/README.md` and `wave17c/README.md` also remain byte for byte; their old commands describe the historical capture. Current instructions are in adjacent `README-frozen-data.md` files, so their evidence hashes are not rewritten. The generated Unicode tables remain byte for byte, including their historical source comments.

The modules below produced or checked the frozen captures. Their last source revisions are listed so the former recipe can be inspected in Git history. No fixture is regenerated in this checkout or in CI. TypeScript tests still authenticate DATA hashes and compare complete outputs. Removed-source pins validate the historical hash and commit record instead of trying to read deleted files.

| Family                | Historical capture/check module                    | Last source revision                       |
| --------------------- | -------------------------------------------------- | ------------------------------------------ |
| aggregation-rss       | `aggregation-rss/generate_oracle.py`               | `56da73ad17829df281f92a44aa85fd36f255463b` |
| aggregation           | `aggregation/generate_oracle.py`                   | `690752022c850b04fb00c6aebbaa364200fd859e` |
| catalog               | `catalog/generate_oracle.py`                       | `4f322ddd9fbd4da25b552eaaa39e903a8eb97d4d` |
| common                | `common/generate_oracle.py`                        | `4a193ddb246af0a06a7399cabfa325e169c22d59` |
| components-rates      | `components-rates/capture.py`                      | `05d6f6eeca9991468f3c94c3c9c26e87d5b0fae0` |
| components-rates      | `components-rates/generate_oracle.py`              | `05d6f6eeca9991468f3c94c3c9c26e87d5b0fae0` |
| dbp-gva               | `dbp-gva/generate_oracle.py`                       | `2826c6c72479bfbaa898c99223ab3c2c51865228` |
| debt-local-validation | `debt-local-validation/generate_oracle.py`         | `0055e3172d713dd65cb1c1655ab7ef1fd771ff31` |
| debt-local            | `debt-local/capture_readers.py`                    | `fbe76fbab2d524954dde829e5e2e295663a84d6a` |
| debt-local            | `debt-local/generate_oracle.py`                    | `fbe76fbab2d524954dde829e5e2e295663a84d6a` |
| editorial             | `editorial/generate_oracle.py`                     | `f23a7ca8790d473e342e427181723b37d060a57f` |
| fiscal                | `fiscal/generate_datasets.py`                      | `f8d81d91b899d797fa6307366cf5b4a0ef7eedd4` |
| fiscal                | `fiscal/generate_oracle.py`                        | `f8d81d91b899d797fa6307366cf5b4a0ef7eedd4` |
| independent-rules     | `independent-rules/capture-nap.py`                 | `3fc2b670e79b2b5918a873e8568d48be3c210b40` |
| independent-rules     | `independent-rules/generate-oracle.py`             | `7bd43e47c67abda4da8ed7f3c78bdaf8d892711d` |
| indirect-taxes        | `indirect-taxes/capture.py`                        | `f8e7f7af6547252dfe9010f22e18fa4548d170b3` |
| indirect-taxes        | `indirect-taxes/regenerate.py`                     | `f8e7f7af6547252dfe9010f22e18fa4548d170b3` |
| law                   | `law/generate_oracle.py`                           | `e16dc047d6134e08b6a80cfa5398e2fe1b2c121d` |
| programmes            | `programmes/capture_pdf.py`                        | `5aa584dcf8bf1fb44e62ff4f1b24c87b94b4197e` |
| programmes            | `programmes/generate_oracle.py`                    | `5aa584dcf8bf1fb44e62ff4f1b24c87b94b4197e` |
| validate14            | `validate14/generate_groups_oracle.py`             | `def05a6a59b060cc338773aa85734acf3f1b21fe` |
| validate14            | `validate14/generate_oracle.py`                    | `def05a6a59b060cc338773aa85734acf3f1b21fe` |
| validate15            | `validate15/compound/generate_oracle.py`           | `44e0ff0f0684826b123b1ebb415ec64cc877db3c` |
| validate15            | `validate15/generate_oracle.py`                    | `d1accf8672a245d81b5358f11df00dbf0c27463f` |
| validate15            | `validate15/generate_unicode.py`                   | `c83875cb46986929bedd10d2c9b31c11992e3a89` |
| validate15            | `validate15/iterable/generate_oracle.py`           | `ea63aa6b3213ae5485fed8a355d8a5f898e267d5` |
| validate15            | `validate15/native/generate_oracle.py`             | `f6e9b6107ae5846aabe0c1ed8c04eb425d354416` |
| validate15b           | `validate15b/generate_helpers.py`                  | `f18eb33977af0a4278e23d2e1e080b1f53fe32ff` |
| validate15b           | `validate15b/generate_oracle.py`                   | `f18eb33977af0a4278e23d2e1e080b1f53fe32ff` |
| validate17a           | `validate17a/boundaries/generate_oracle.py`        | `d34b389dca26f64285ca3d65a3f998a0d01eab32` |
| validate17a           | `validate17a/catalog-semantics/generate_oracle.py` | `7d3506e5a872ef180687fb38ec3744e5a7a28789` |
| validate17a           | `validate17a/containers/generate_oracle.py`        | `bae75dd5d741c934ace2c16e49a932c2b51b445b` |
| validate17a           | `validate17a/generate_oracle.py`                   | `d2e4395cd4889326e2c417b336fbd2287b64fdbf` |
| validate17a           | `validate17a/gzip-cache/generate_oracle.py`        | `3c364e0ad601fb5344291641c7dccc52540e88e0` |
| validate17a           | `validate17a/integer-limit/generate_oracle.py`     | `d828a13ee0f565a1d4c10eb803be6e333e184938` |
| validate17a           | `validate17a/integer/generate_oracle.py`           | `fe5aeab3b717117f1b11ac4d0180e01667ee93b1` |
| validate17a           | `validate17a/iterators/generate_oracle.py`         | `38a26103789f2185d44f9216694c6e13c127e6ee` |
| validate17a           | `validate17a/key-whitespace/generate_oracle.py`    | `093366d33b5b32a6fa58ca086a90813869388f58` |
| validate17a           | `validate17a/membership/generate_oracle.py`        | `02a3942e1c2bcdf55a18b2c4df40fbccf851dd3e` |
| validate17a           | `validate17a/reader/generate_oracle.py`            | `65e1c10f2b9a0826d39f958b55ab1e0c9af401c5` |
| validate17a           | `validate17a/review/generate_oracle.py`            | `41ead80e1c5e5a75a04086109fe76451518670c0` |
| validate17a           | `validate17a/short-circuit/generate_oracle.py`     | `4059cf326157e5d7da8d3edd9b1868212c0b6556` |
| validate17a           | `validate17a/source-strings/generate_oracle.py`    | `39770320f6b6040c7438f125c180ab2bebecb6ff` |
| validate17a           | `validate17a/wrapper/generate.py`                  | `d2e4395cd4889326e2c417b336fbd2287b64fdbf` |
| validate17a           | `validate17a/year-keys/generate_oracle.py`         | `39770320f6b6040c7438f125c180ab2bebecb6ff` |
| validate17b           | `validate17b/generate-extra.py`                    | `34c1765228ecf5d5dfbb7a9d64afe80dbf2b40f7` |
| validate17b           | `validate17b/generate.py`                          | `ddae190e2adb64dfdf57780b664aa8f2a8eb8c3a` |
| validate17b           | `validate17b/population/generate.py`               | `b3ec3ed7b128b7c14dcf2656a2e9271ce2a63238` |
| validate17b           | `validate17b/years/generate.py`                    | `c67b186f517e0dabc4fb86eca03f5c33c3fcf87d` |
| wave13a               | `wave13a/generate_budget.py`                       | `11ebfe82f9b474e51f65c0312a1eaa3bf8471f0a` |
| wave13a               | `wave13a/generate_law_next.py`                     | `516c2a70229ed08c2cfed2c0f9ef6887f1469d6b` |
| wave13b               | `wave13b/generate_oracle.py`                       | `f8e7f7af6547252dfe9010f22e18fa4548d170b3` |
| wave17c               | `wave17c/check_provenance.py`                      | `3ef428a2a619224c2bbee683d4721a4822f37d46` |
| wave17c               | `wave17c/generate.py`                              | `3ef428a2a619224c2bbee683d4721a4822f37d46` |
| wave17c               | `wave17c/generate_unicode.py`                      | `3ef428a2a619224c2bbee683d4721a4822f37d46` |
| wave17c               | `wave17c/routes/generate.py`                       | `17eb1dbbe9f7e6068ccde6557d38af5907ef4909` |
| wave17c               | `wave17c/sources/generate.py`                      | `ae143978187be9c815b7edc6013f864f45d05b60` |
| wave18                | `wave18/check_provenance.py`                       | `0d39213477636c1f6753f8ab7ffa0fa40ddbc28d` |
| wave18                | `wave18/differential.py`                           | `729019a60d32885d91855bc4afb498a648877466` |
| wave18                | `wave18/oracle.py`                                 | `0d39213477636c1f6753f8ab7ffa0fa40ddbc28d` |

| catalog | `catalog/synthetic_primary.py` | `4f322ddd9fbd4da25b552eaaa39e903a8eb97d4d` |
| validate15b | `validate15b/audit_pdf.py` | `f18eb33977af0a4278e23d2e1e080b1f53fe32ff` |
| validate15b | `validate15b/source_methods.py` | `5c9794c45d3fc6db7cc484ec41247cee2e65a622` |
| validate15b | `validate15b/source_order.py` | `5cc735fd557c4818d8799e397d89fb0b1ba28051` |

Frozen inventories, including `wave13a/inputs-sha256.json`, `catalog/provenance.json`, `validate14/tracked-paths.json` and `validate14/code-path-capture.json`, remain unchanged. A Python path inside one of those historical corpora remains data. The catalog loader still reads only its declared data inputs and owner streams; it does not infer a new file set by walking the directory. The Wave13a manifest hash still authenticates the same inventory bytes.

The six Python reader capture utilities directly under `test/` and `test/readers/` are outside this fixture-directory removal. Their documentation and other Python removal steps are separate work.
