# Add a Microduck policy

Submit a **Hugging Face model repository URL or exact ONNX file URL** through [Register a policy](https://github.com/ob1-s/uduck-registry/issues/new?template=register-policy.yml). For a repository containing multiple ONNX files, use its `/blob/<revision>/<artifact>.onnx` URL so the resolver cannot guess which artifact you mean. The resolver pins one immutable upstream revision, verifies the exact artifact bytes, and reads a machine-readable manifest when the publisher provides one.

For an agent using `gh`, the equivalent is:

```sh
gh issue create --repo ob1-s/uduck-registry --title 'Register my move' --label policy-submission --body '### Policy URL

https://huggingface.co/your-name/microduck-your-move

### Category

experimental

### Notes

Optional reviewer context'
```

The bot resolves the package without loading the ONNX in the write-capable job. It opens a review PR containing one file at `registry/policies/<id>.json`; CI performs package inspection and any covered registry diagnostic. Edit the issue to retry a failed resolution; reopening it is an alternative retry. Notes are bounded reviewer context and are never treated as runtime evidence.

## Local contribution

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/policy/requirements.txt
export UDUCK_PYTHON="$PWD/.venv/bin/python"
pnpm install
pnpm uduck resolve https://huggingface.co/your-name/microduck-your-move
pnpm uduck register https://huggingface.co/your-name/microduck-your-move --category agility-tricks
pnpm policies:prepare
pnpm validate
pnpm test
pnpm compile
```

Only `registry/policies/<id>.json` belongs in a contribution. It contains:

- `source`: provider, repository, immutable 40-hex revision, safe ONNX path, artifact SHA-256, and optional manifest path/SHA-256;
- `curation`: category, tags, editorial copy, authors, license, notes, optional author media, source-backed setup requirements, and separately labeled publisher hardware claims.

Runtime facts are resolved from the pinned upstream manifest. Missing facts remain unknown. Do not invent normalizers, action scales, slots, hardware evidence, command values, or environment details from prose. Do not commit `.generated/`, public indexes, or diagnostic media.

The accepted providers are GitHub, Hugging Face model repositories, and Hugging Face Spaces. Each entry identifies one ONNX artifact. A repository containing several policies needs a separately reviewed entry for each artifact, with the exact path and hash recorded. Cataloging a GitHub or Hugging Face Space artifact does not make it robotctl-installable; install commands are synthesized only for supported single-artifact Hugging Face model sources.

## Maintainer execution recipes

Execution recipes live in `simulation/execution_recipes.py`, not in authored policy JSON. A recipe is allowed only when the maintainer can state the runner, model, scene, start state, command schedule, duration, checks, and provenance precisely. The resolver turns a covered recipe plus resolved manifest into one concrete `ExecutionSpec`.

The runner accepts only a valid `ExecutionSpec`. A source without a recipe, an incomplete manifest, or an unsupported environment produces visible `not-covered` evidence; it is not coerced into a generic command or alternate runner. ONNX shape inspection is package evidence, not a behavior simulation, and a registry diagnostic is not hardware verification.

See [simulation/README.md](simulation/README.md) for the runner contract.

## Evidence and media

Author media may show bespoke environments or hardware, but remains publisher material. Registry evidence is produced by trusted CI, binds the exact source artifact to execution-relevant inputs, and is archived as a content-addressed Release blob named `<blob_sha256>.tar.gz`.

The execution identity v3 includes the immutable source, the resolved manifest fields used by the recipe, that entry's recipe, the executable runner code, asset/dependency locks, and the environment contract. Curation-only edits do not invalidate evidence. Changing one entry's source or recipe invalidates that entry's evidence only. Failed diagnostics remain visible as failed; uncovered diagnostics remain visible as not-covered.

## Repository setup

The URL bot requires the `policy-submission` label and Actions permission to create pull requests. Create the label once with:

```sh
gh label create policy-submission --repo ob1-s/uduck-registry --color 0E8A16 --description 'Policy URL submissions processed by the registry bot'
```

The bot uses `GITHUB_TOKEN`; no contributor storage credentials are needed. See [AGENTS.md](AGENTS.md) for repository invariants.
