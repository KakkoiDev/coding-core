# Copyable local and CI pipeline

Normal offline behavior gate:

```sh
python3 -B tools/check.py
```

Contributor setup, once with network:

```sh
npm ci --ignore-scripts
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
```

Contributor gate:

```sh
npm run lint
npm run format:check
.venv/bin/ruff check python tests tools
.venv/bin/ruff format --check python tests tools
python3 -B tools/check.py
```

Use `.venv/Scripts/python` and `.venv/Scripts/ruff` on Windows. Copy package.json,
package-lock.json, eslint.config.mjs, pyproject.toml, requirements-dev.txt, the
behavior tests and [.github workflow](../.github/workflows/check.yml) as a starting
pipeline. Keep host tooling when already established; adapt paths, do not maintain
two conflicting configurations. Runtime dependencies are locally vendored; dev
packages are pinned by the npm lockfile and exact Ruff version. Python type checks
are not configured in v0.1: add a host-appropriate checker when its types warrant
it rather than claiming unchecked code is type safe.

`npm run build` produces a reproducible source zip with recipes and vendored
licenses, excluding caches and dev installations. `tools/check-syntax.mjs` checks
JS syntax separately if needed; plain JS/Python requires no runtime compilation.
Do not call a syntax-only pass a functional test.
