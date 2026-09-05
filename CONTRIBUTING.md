# Add a Microduck policy

Submit the **Hugging Face model repository URL** through [Register a policy](https://github.com/ob1-s/uduck-registry/issues/new?template=register-policy.yml). No fork, JSON, or local simulator required.

For an agent using `gh`, the equivalent is:

```sh
gh issue create --repo ob1-s/uduck-registry --title '[policy] My move' --body '### Policy URL

https://huggingface.co/your-name/microduck-your-move

### Category

experimental'
```

The bot pins the Hub commit, reads Pollen's schema-2 manifest, hashes the manifest and `policy.onnx`, checks the ONNX interface and finite outputs, and opens a review PR. It explicitly starts CI for that branch. Maintainers review the license, commands, and curation before merging. Failed ingestion is reported back on the issue; correct the URL and reopen the issue to retry.

Publish a package with [Pollen's publisher](https://github.com/pollen-robotics/microduck_rl#publishing-a-policy) first if you only have a raw ONNX file. Official multi-policy sets, custom runtimes, and legacy sources remain possible through a normal issue and maintainer review.

## Local contribution

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/policy/requirements.txt
export UDUCK_PYTHON="$PWD/.venv/bin/python"
pnpm install
pnpm uduck resolve https://huggingface.co/your-name/microduck-your-move
pnpm uduck register https://huggingface.co/your-name/microduck-your-move --category agility-tricks
pnpm policies:prepare
pnpm check
```

Commit only `registry/policies/<id>.json`. You may edit its category, tags, summary, notes, and author media URLs. Runtime facts come from the pinned upstream manifest; hashes come from downloaded bytes. Do not invent missing values, translate prose into simulation commands, or label an ONNX smoke check a successful behavior test.

`pnpm validate` is an offline schema/identity check. `pnpm policies:prepare` performs network resolution and ONNX inspection. `pnpm build` produces the public indexes and static site from prepared facts. CI does all three. Generated indexes, resolved facts, and simulation videos are build outputs and do not belong in contributions.

## Custom and existing entries

`registry/behaviors/` contains the existing, manually reviewed descriptor format. Its fields are historical publisher/curator claims, not a second package standard. Keep existing URLs stable. Prefer migrating a published Pollen package to a pointer; do not mechanically infer missing metadata from an older descriptor.

`pnpm new-behavior id=my-move` emits an intentionally incomplete draft with unknown runtime sections set to `null`. Save it outside `registry/behaviors/`. `pnpm preflight <draft.json>` reports missing/invalid values. Resolve them from source evidence before proposing a custom entry. A default walk slot, action scale, normalizer flag, or simulated terrain is never evidence.

An explicit legacy simulation recipe remains a maintainer-owned diagnostic. Unsupported objects, scenes, command encodings, or actuator physics must be described honestly. See [simulation/README.md](simulation/README.md).

## Evidence and media

Author media is welcome, including bespoke scenes and hardware clips; link to the publisher's HTTPS media. It remains separate from registry evidence. Existing cached author media is retained for continuity.

CI reruns registry diagnostics, publishes matching reports and renders into the static build, and archives main-branch outputs in a GitHub Release. Contributors never commit generated videos. Reports bind the policy hash to the full descriptor, executable runner, dependency specification, and pinned asset lock. Changing those inputs invalidates earlier display evidence. A failed measured check remains visible as failed. No diagnostic establishes hardware verification.

## Repository setup

The URL bot requires Actions to be allowed to create pull requests (repository Settings → Actions → General). It uses `GITHUB_TOKEN`; no PAT or external storage credentials are needed. The existing Cloudflare deployment secrets remain the deployment mechanism. New workflows take effect after this change reaches the default branch.

See [research/registry-direction.md](research/registry-direction.md) for responsibilities, upstream findings, and the branch reconciliation.
