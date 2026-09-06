# 🦆 uDuck Registry

An independent community catalog of [Microduck](https://github.com/pollen-robotics/microduck) policy artifacts.

[Browse the library](https://uduckmoves.com) · [Submit a policy URL](https://github.com/ob1-s/uduck-registry/issues/new?template=register-policy.yml) · [Contributing](CONTRIBUTING.md)

Pollen owns the policy package, publisher, installation commands, and robot runtime. Hugging Face and GitHub host upstream artifacts. uDuck adds discovery, curation, immutable source identity, and independent diagnostic evidence.

## One registry boundary

Every authored entry is a `registry/policies/<id>.json` file containing one immutable upstream ONNX artifact and editorial curation. Preparation resolves the source and manifest, the maintainer recipe layer creates an `ExecutionSpec` when coverage is possible, and the website consumes one public `CatalogEntry` shape.

Missing runtime facts stay unknown. A package inspection proves only that the pinned ONNX has the expected interface and finite zero-input output. A registry diagnostic measures the stated runner; neither is hardware verification or a reproduction of arbitrary publisher evaluation.

## Catalog

The live catalog is generated from the authored policies and served at [uduckmoves.com](https://uduckmoves.com). Machine consumers can use the generated [`registry.json`](https://uduckmoves.com/registry.json) index.

## Develop

```sh
pnpm install
python3 -m venv .venv
.venv/bin/pip install -r scripts/policy/requirements.txt
export UDUCK_PYTHON="$PWD/.venv/bin/python"
pnpm policies:prepare
pnpm validate
pnpm test
pnpm compile
pnpm dev
```

`pnpm validate` checks authored policy data offline. `pnpm policies:prepare` fetches and verifies the pinned upstream artifacts, reads manifests, and inspects ONNX interfaces. `pnpm compile` emits `public/registry.json`; generated facts, indexes, and simulation media are build outputs.

## Machine interfaces

- [`/registry.json`](https://uduckmoves.com/registry.json) — the generated `RegistryIndex` with `entries` only.
- [`/api/behaviors/<id>`](https://uduckmoves.com/api/behaviors/flamingo-cycle) — one `CatalogEntry` for a catalog item.
- [`/llms.txt`](https://uduckmoves.com/llms.txt) — compact machine-oriented guidance.

Product URLs remain `/behaviors/<id>`.

Apache-2.0; upstream policy artifacts and media remain under the licenses declared by their authors.
