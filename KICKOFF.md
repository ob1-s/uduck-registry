# uDuck Registry — current project notes

uDuck Registry is a small, static catalog for Microduck behavior policies. The
individual JSON files in `registry/behaviors/` are the source of truth. The
generated `public/registry.json` is the machine-readable snapshot consumed by
static hosting.

## Local workflow

```bash
pnpm install
pnpm validate
pnpm test
pnpm compile
pnpm build
```

The production output is `out/`, which can be uploaded to any static host. The
`start` script serves that directory locally; it is not a Next.js server
deployment.

## Registry rules

- IDs are lowercase kebab-case and the JSON filename must match the ID.
- The current Microduck policy contract is 61 observations, 14 actions, and a
  50 Hz control loop.
- `discovery.status` is `listed` for downloadable policy artifacts and
  `source_only` for upstream task records without a currently available ONNX.
  Source-only records are validated but omitted from the public index, UI, API,
  and CLI.
- Verified policy artifacts carry a recorded byte size and SHA-256 hash.
  `vendor/policies/` is an optional local cache; it is not required for a clean
  checkout or catalog validation.
- `community_experimental` is an honest default for an entry without a
  reproducible artifact or evidence. It is not simulation verification.
- `verified_simulation` is reserved for an entry with a passing, recorded
  MuJoCo run using the declared model and policy.
- Hardware evidence belongs in the submission PR. Do not turn a description or
  a video caption into an attestation.

## Submission

`pnpm cli submit path/to/behavior.json` validates the descriptor and attempts a
GitHub PR using device-flow authentication or `GITHUB_TOKEN`. If GitHub access
is unavailable, it prints the validated JSON and a manual PR URL and exits with
an error so automation can detect that no PR was created.

The repository intentionally does not auto-sync upstream repositories or host a
policy update service yet. Those are separate product decisions once more
community policies exist.

## Scope boundary

The registry describes compatibility and provenance. It does not guarantee that
a policy is safe for a particular robot, surface, battery, accessory, or human
environment. Test simulation and hardware in a controlled space.
