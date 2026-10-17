# coding-core

Opinionated, agent-first JavaScript and Python recipes for common application
work: pure transformations, explicit effects, validated boundaries and tests.

Uses **Lodash 4.18.1 (`lodash/fp`)** and **Toolz 1.2.0**, with complete local package
copies, licenses, archive provenance and file hashes. Runtime recipes need Node
18+ or Python 3.11+, with no package download. Contributor checks use Node 22+, Python 3.11+ and pinned dev
tools. Toolz is BSD-3-Clause; Lodash is MIT. Original recipes are MIT.

Start with [AGENTS.md](AGENTS.md), [recipes](RECIPES.md),
[dependencies](docs/dependencies.md) and [copyable pipeline](docs/pipeline.md).

```sh
python3 -B tools/check.py
```

This verifies local dependency hashes, documentation links, JS/Python behavior
and builds `dist/coding-core-0.1.0.zip`. It does not install dev tools. Run the
separate lint/format gate before publishing changes. The zip is a deterministic
source kit, not a transpiled application.

Examples cover data pipelines, grouping/indexing, validation, configuration,
pagination, integer cents, state transitions, retries, atomic JSON and injected
time. JS also has bounded concurrency. HTTP, project boundaries and Python async
concurrency are documented guidance rather than a shipped service implementation.

Do not copy this whole repository into every prompt. Route to one recipe, adapt
its code/test to the host, preserve dependency licenses and record the pinned
core commit. No Pi integration or weak-model benchmark is claimed yet.
