# Registry direction and reconciliation — 2026-09-05 (final)

## Responsibility

Pollen defines packaging, publishing, installation, runtime behavior, and robot safety. Hugging Face hosts weights and model cards. uDuck owns discovery, editorial context, immutable artifact references, and reproducible diagnostic observations. We should not invent a competing runtime contract or claim our simulator is the training environment.

Read GitHub issue [#17](https://github.com/ob1-s/uduck-registry/issues/17). The useful direction is pointer + curation, manifest ingestion, URL submission, and evidence outside source history. Several implementation claims in earlier discussion need correction:

- [Pollen's manifest](https://github.com/pollen-robotics/microduck/blob/bc41fb5c9a9b39894669c1e022e375cf83800382/docs/policy-manifest.md) explicitly makes fields optional. Missing fields are not compatibility evidence. Schema 2 by itself proves neither origin nor a baked normalizer.
- A constant encoding describes how the daemon feeds a command, not which command activates a behavior. Flamingo is a concrete counterexample: `[flag, side, 0]`. Do not infer a velocity sweep or an all-zero successful behavior from its `kind`.
- [The robot cheatsheet](https://github.com/pollen-robotics/microduck/blob/bc41fb5c9a9b39894669c1e022e375cf83800382/docs/robot/cheatsheet.md) supports raw local files, manifest-less repositories, explicit files in repositories, `@revision`, and held-pose commands. “Not a schema-2 single-policy package” does not mean “impossible to install with robotctl.” Our automated admission policy is intentionally narrower than upstream's runtime.
- Manifest validity and ONNX shape checks cannot justify automatic behavioral certification or hardware verification. The registry runner uses position-control diagnostics, not the publisher's BAM training environment.
- GitHub-token PRs may leave PR workflows pending approval. [Explicit workflow dispatch](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) runs CI for the bot branch.
- Native ONNX parsing/inference belongs in a job without write credentials. The PR-writing job only validates inert pointer data.

Upstream pin reviewed 2026-09-05: `pollen-robotics/microduck@bc41fb5c9a9b39894669c1e022e375cf83800382`. Flamingo command `sudo robotctl policy add flamingo RemiFabre/microduck-flamingo-cycle --hold 5 --command 1,1,0` and the all-zero default for plain episodic skills (“Most skills need none: they are trained on an all-zero command”) are documented at that revision.

## Final architecture

- Two internal authored sources: `registry/behaviors/` (legacy/manual) and `registry/policies/*.json` (pointer + curation: stable ID, upstream repo, immutable 40-hex revision, manifest SHA-256, artifact SHA-256, category/tags/summary/notes, author media). Pointers contain no runtime copies, no recipes, no verification claims.
- One public consumer model: `CatalogEntry` (RegistryIndex `version 3.0.0`, `count`, `entries` only). Pages, APIs, search, cards, index generation, and social cards consume it. Existing `/behaviors/<id>` URLs remain stable; Flamingo lives at `/behaviors/flamingo-cycle`. Temporary `/policies` routes from earlier WIP were removed before shipping.
- `.generated/policies/` holds build-local resolved upstream facts from the shared Python resolver (CLI, local registration, issue ingestion, build preparation share one implementation).
- Maintainer-owned recipe layer (`simulation/pointer_recipes.py`) separate from pointer JSON. Flamingo binds repo + revision + manifest SHA + artifact SHA + manifest name; any change makes it not-covered. Generic zero-command coverage is a privilege requiring episodic, finite duration, constant/absent encoding, no twist/head/body prose, complete I/O widths, control_hz 50, explicit finite action_scale, and standing/absent entry pose. No silent `action_scale=1.0`.
- Pointer simulation runs through the existing standardized runner with explicit `command_schedule` validation, source-hash verification before inference, and recipe provenance (owner, pinned upstream docs, command, duration, start, runner, scene, checks, scope/limitations, non-eval-reproduction statement).
- Author media (publisher HTTPS links) separated from registry evidence (pinned runner renders). Publisher eval/hardware claims separated from independent verification.
- Durable evidence is a content-addressed GitHub Release (`registry-evidence`): semantic `evidence_key = sha256("uduck-evidence-v2" + inputs + artifact)`, physical `blob_sha256 = sha256(archive bytes)`, asset filename `<blob>.tar.gz`, mutable `index.json` mapping current IDs to keys while retaining history. Archived reports exclude wall-clock timestamps; observation time is index metadata. Same-key/same-blob reruns are idempotent; conflicting content raises.
- Execution identity v2 (`uduck-execution-inputs-v2`) covers only execution-relevant authored state plus runner code, asset lock, dependency pins, and `ubuntu-24.04/python3.12` environment contract. Curation-only edits do not rerun simulation.
- CI build hydration: resolve pinned policies → plan cache from durable index → run runner tests → run only uncached diagnostics → temporary artifact → (main only) publish immutable blobs + update index → hydrate trusted current evidence → build → deploy. PRs never publish. Main pushes serializing the mutable index. Required check `Validate Registry & Build` preserved.
- Cross-build cache with pruning of deleted IDs, partial-publish recovery (blob names make retry safe), and fail-closed hydration validation (traversal, symlinks, size, ID/key/inputs/artifact checks, rendered vs report-only file rules, stale-file clearing).
- Read-only ONNX resolution job → separate write-capable proposal job; explicit dispatch for bot branches; failed checks stay visible; unsupported policies stay discoverable as not-covered; no automatic merge; no hardware certification.

## Deliberate coverage limits and upstream constraints

- Package inspection (SHA, ONNX I/O, finite zero-input smoke) is separate from registry simulation and from hardware. A successful ONNX inference is not a behavior test; a registry simulation is not hardware verification; publisher media is not registry evidence.
- Flamingo diagnostic tests stability under the documented `[1,1,0]` 5s hold (`no_fall` plus unilateral-support observations). It does not certify one-foot-task success. No unwind is invented (manifest has no `unwind_s`).
- Generic zero coverage applies only when documented upstream semantics plus complete machine-readable contract make the diagnostic non-invented. Otherwise not-covered.
- No nightly discovery, HF crawling, auto-accept/merge, new BAM simulator, hardware testing, contributor identity verification, general robotctl source support, full legacy migration, CDN, or database. Those are future work.

## Activation check

The repository has `default_workflow_permissions: read` and `can_approve_pull_request_reviews: false`. The latter disables bot PR creation; enable it before using the URL bot. Default permissions stay read-only. Main protection requires `Validate Registry & Build`; that name is preserved. No repository settings were changed during implementation.
