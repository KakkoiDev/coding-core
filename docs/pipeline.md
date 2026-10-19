# Copyable local and CI pipeline

Normal offline behavior gate:

```sh
python3 -B tools/check.py
```

It includes the end-to-end gate, which also runs alone:

```sh
python3 -B tools/e2e.py
```

That runs every e2e test in `tests/e2e/` (JavaScript and Python), checks with the
vendored `tools/test-core/scenarios.py` that each scenario in
[SCENARIOS.md](../SCENARIOS.md), [concurrency](../recipes/concurrency.md) and below
has a test of the same name that ran and passed, and runs
`tools/test-core/flaky_lint.py` over `tests/`. coding-core has no pages, so the
control-coverage rule (`e2e_coverage.py`) and browser launch flags do not apply here.

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

## Scenarios of the check and build commands

Each is one end-to-end test in [tests/e2e/test_commands.py](../tests/e2e/test_commands.py), named after its title.
The test copies the repository to a scratch folder and runs the command there, as a contributor would.

### Scenario: Build the source kit
Given a clean copy of the repository
When I run the build twice
Then dist/coding-core-0.1.0.zip holds the recipes, the code and the vendored licences
And it holds no caches, dependency installs or Git data
And both builds are byte for byte the same

### Scenario: A drifted vendored file stops the check
Given a copy of the repository where one vendored Lodash file was edited
When I run the offline check
Then it fails and names the drifted file

### Scenario: A broken documentation link stops the check
Given a copy of the repository with a Markdown link to a missing file
When I run the offline check
Then it fails and names the file and the missing target
