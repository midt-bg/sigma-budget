# Release build verification

Implementation is local on `fix/release-build`, based on `838c64c`. Nothing was pushed; no PR was created. `data/release` is unchanged.

Commits: `ddfd765` ports the staging/glue/DBP fixes, adds offline preparation and frozen editorial/terminology inputs; `5ebf0df` records acquisitions and restore instructions; `c5ec8a4` preserves the published historical provenance labels. The final documentation commit contains this report.

## Acquisition, 2026-11-08 UTC

Existing `sources.download` commands fetched the three DV HTML pages and SEBRA listing (HTTP 200) and probed the three minfin pages (HTTP 403). An independent `sources.access_probe --only minfin` observed 403 Cloudflare challenges with urllib and curl on all four minfin URLs. No other live sources were refreshed. The manifest retains the audit's actual earlier acquisition entries and adds these fresh observations; it does not reconstruct the missing historical manifest.

The ASBP sidecar records a fresh local acquisition from the PDF tracked at `838c64c`, including git blob, size, hash, time and method. It does not claim a publisher download. The PDF itself remains unchanged.

| Re-pinned file under data/originals | Previous SHA-256 | New SHA-256 |
|---|---|---|
| `asbp/UMTBF-2026-2028-motivi.source.json` | `550ca3fd3644dafdc788674cb0f5155df91dc4399ad82f3478e29f68aca0bb66` | `f9bcf8b9c46d3892911e44fefac3d369f94c600e47564554a2a69bd82e0ec87f` |
| `dv/zbdoo2026_dv68_idMat244982.html` | `5ff97d5c9e3c75f6a9756afc48e6eef6ceb37b9fb8287ef56f655ff13ebcd145` | `e6c8053b7a63e20a5502b6b151a322bf36aece1f09d7bad28fdc3fee6f4d5431` |
| `dv/zbnzok2026_dv68_idMat244981.html` | `ed7110bfc489ab16f2d62bb34fddcccdf183478ad18af56876931f53046509e4` | `71a10a0b0e3edb9d3ee963c9325bfd4544048bc86665b0d4f44cdfd0bafeee5b` |
| `dv/zdb2026_dv69_idMat245041.html` | `b5eb1db99e0cfb3a5b7840472985345b3d1a9b974b9a8a861b1b7a557522a119` | `1f5e85a3e1ae95e55c4d331a5f0ab6e97efd1d64ede5ff529886df7e5e12e160` |
| `MANIFEST.json` | `18a9f1f6d54512e0a3e9d4ad5a30e64e95e31a333459a094f849e4bf77accf4c` | `14bdab2e614b7bfc8a97978dbc7439e6e2bbeceaac0363ba62c9ee2d74b10339` |
| `sebra/midt_sebra_2026_page.html` | `677aab28b65b7eef4b5b2e3ced49cd8c77d72c2bd17c3ead3bf77fa976a14ad8` | `d51a8eff26110c6a0b07250c33a2320763e0d23d3a041243b94d5d704b3aa259` |

Pins changed only after comparison. `extract.dv_laws` reproduces `dv_laws_2026.json` byte-for-byte (SHA-256 `3c57a957936a81f27bf7443507a24218368070405b08fd49367e2f6bde06b7b3`). `build.payments.build_sebra` reproduces the published SEBRA bytes (`b79d6fc2508863308efde2c5ef0c0b033739deb44dea31dbd17218807637b94a`). The ASBP table and page extractors reproduce their prior intermediates byte-for-byte (`27b82e1b8059c88b70dab8cf588c944e444b3532d4eba9fe1b085a776e4b2d3a` and `2d80b15c16e0e26f658f057577c1f4bf0badb589cd744781cd94c90a919eeff4`). All candidate financial data files match the published bytes.

## Restore

Follow the short procedure in [data-acquisition.md](data-acquisition.md#restore-the-release-build-snapshot). Supply the separately retained `work/release-build-inputs.tar.gz` archive to the fresh machine; it contains only the 108 registered originals/cache inputs, with zero missing inputs. This archive is necessary: live downloads cannot restore an exact historical snapshot.

Archive SHA-256: `1fa327738fb8fd2af276bcfca7ca5a4dfdcb6057b516f7f54564a1dd05f1963c` (68834746 bytes).

A clone made with `--no-local --no-tags --single-branch` was restored using only that archive and the documented uv/prepare commands. It passed the local build and candidate validation. Docker and restored local builds have identical data, manifest and validation report (70 identical files); only `receipt.json` differs in environment/time. Both produce release ID `0d3fb3ee49d40957f30769192a2cadea86c0862a952e5c88ee7cdf35b56071ab`, from code commit `c5ec8a4`.

## Candidate against published release

The command was exactly `./budget build --build-date 2026-11-05`, using Docker. It wrote `work/candidate`; `--site` was never used. All 68 published data files are present: 67 are byte-identical, with one exception:

| File | Every changed field | Reason |
|---|---|---|
| `catalog.json` | `files[0..2].sha256`, `files[0..13].retrieved`, `traps[3].text`, `traps[3].evidence` | Fresh DV hashes; dates from the retained audit acquisitions and new downloads; newly observed minfin probes and their actual date. No budget values changed. |

Thus the literal expectation of changes only outside the data directory is not met: acquisition metadata is embedded in the catalog. Preserving its old bytes would misrepresent the new acquisition. Published historical `releases/` metadata is excluded from candidate data by design; the new manifest, validation and receipt live at the candidate root. There are no missing or added candidate data files.

## Checks

| Check | Result |
|---|---|
| Strict Docker build | PASS; 108 inputs, zero missing |
| Fresh clone, documented restore, local build | PASS; no tags |
| `./budget validate --release work/candidate` | PASS; 47,304 checks, zero problems, 15 warnings |
| `./budget validate --site` | PASS; published release unchanged |
| `python -m budget_pipeline.validate.registry check` | PASS |
| `python -m budget_pipeline.validate.datasets` | PASS; 47,304 checks, zero problems, 13 warnings |
| Local staging regression | PASS |
| CI uv hash-locked installation, npm ci, TypeScript | PASS |
| CI examples, compatibility, query checks | PASS |
| CI data image build and environment import check | PASS |
| CI release API / restore drill | PASS; 60 / 17 checks |
| CI staging build and screen crawl | RESULT: PASS · failures 0 · warnings 42 |
| CI Worker browser screens | FAIL; 917 checks, 7 failures in one S07 cell from ERR_NETWORK_CHANGED. Isolated retry: PASS, zero failures. |
| CI old addresses | redirects: 22 case(s), 0 problem(s) |
| CI calculator | RESULT: PASS: 699 checks, 0 failures |
| CI sharing/export | RESULT: PASS: 285 checks, 0 failures |
| CI acceptance figures | RESULT: PASS: 815 checks, 0 failures, 0 notes |
| CI motion | RESULT: PASS: 73 checks, 0 failures |

The full screen run reported six failed module requests (`ERR_NETWORK_CHANGED`) and their resulting dynamic-import error in S07 at `#/razhodi?po=vid`, 400-light. Repeating `--route S07 --cells 400-light --only base` on port 8843 passed both samples with zero failures. The original full-suite failure remains recorded; no check was edited.

Browser checks use ports 8841/8842; release API checks used 8826. An initial run lacked host openssl; rerunning with the real openssl binary/libraries from the pinned image passed. An initial staging crawl on shared port 8816 lost its Worker; the isolated-port rerun is reported above. No deployment was attempted.

## Reproducibility limits

The original editorial guide text and glossary PDF were absent from the handoff and searches of the available repository worktrees. Their published files are now tracked frozen editorial inputs with commit/path/blob provenance, rather than claimed regenerations of those lost texts. Terminology pairs preserve the exact ordered replacements from mock-v2/mock-v4; all six source blobs are recorded in `data/sources.yaml` and no runtime tag lookup remains.

Other pre-existing upstream gaps for frozen `data/inputs` remain honestly declared in `data/sources.yaml` (including COFOG, population, component/function breakdowns, debt and measures). The release is reproducible from those tracked frozen inputs and the retained archive; it does not claim to regenerate every frozen input from its original publisher. Missing historical acquisition records have not been fabricated. No checks were weakened.

`gva-sectors.json` remains a retained published output, explicitly `notRebuilt` in the registry: the original October Eurostat answers are unavailable, and the later revised answers do not reconcile with the published GDP series. No GVA source was refreshed. The strict chain also retains the two published examples; their independent producer was checked with `--build-date 2026-10-09` and reproduces both byte-for-byte. Retained outputs are not claimed as regenerated.
