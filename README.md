# 🦆 uDuck Registry

An independent community library of [Microduck](https://github.com/pollen-robotics/microduck) policies.

[Browse the library](https://uduckmoves.com) · [Submit a policy URL](https://github.com/ob1-s/uduck-registry/issues/new?template=register-policy.yml) · [Contributing](CONTRIBUTING.md)

Pollen owns the policy package, publisher, installation commands, and robot runtime. Hugging Face hosts the artifacts. uDuck adds discovery, curation, pinned source identity, and independent diagnostic evidence.

## Contribute

Publish with Pollen, submit your Hugging Face repository URL, and the bot prepares a pinned pointer PR. It reads the manifest and inspects the ONNX without asking you to restate runtime metadata. Maintainers review the result. Custom and legacy sources have a manual review path.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the form, agent command, and local workflow.

## Read the evidence

- **Publisher media and eval:** the author's demonstration or claim, including bespoke environments.
- **Package inspection:** pinned manifest and artifact hashes, ONNX interface, finite-output smoke check.
- **Registry simulation:** measured checks in our stated diagnostic runner, with exact inputs. A completed video is not necessarily a passed check.
- **Hardware:** a separate evidence axis. Upstream origin alone does not establish independent registry verification.

The existing catalog retains legacy publisher/curator descriptors. New Pollen packages use small pointers in `registry/policies/`; resolved facts are generated from upstream. Missing facts remain unknown.

## Develop

```sh
pnpm install
# If the catalog contains Pollen pointers, first set up Python as in CONTRIBUTING.md.
pnpm policies:prepare
pnpm check
pnpm dev
```

`pnpm validate` checks authored state offline. `pnpm policies:prepare` fetches pinned upstream facts and checks ONNX. `pnpm build` compiles the indexes and exports the site. Generated indexes and simulation media are not committed.

CI reruns diagnostics for the static deployment and archives main-branch evidence in GitHub Releases. See [simulation/README.md](simulation/README.md) and [registry direction](research/registry-direction.md).

The v2 registry index keeps legacy `behaviors` and new `policies` pointers in separate arrays; `count` covers both. Resolved package facts are available from `/policies.json`.

Machine interfaces: [`/policies.json`](https://uduckmoves.com/policies.json), [`/registry.json`](https://uduckmoves.com/registry.json), [`/llms.txt`](https://uduckmoves.com/llms.txt).

Apache-2.0; policy licenses remain those declared by their publishers.
