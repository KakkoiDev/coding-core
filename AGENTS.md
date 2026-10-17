# coding-core agent router

Inspect the host AGENTS.md/CLAUDE.md/README first. Preserve its language, module
style, return/error conventions and working tests. Own the request through a
verified result. Use [the recipe index](RECIPES.md) to load one relevant recipe,
then the paired source/test. Do not ask the user to choose a recipe.

Prefer pure domain functions, explicit inputs/outputs, new values instead of
mutation, and I/O at the edges. Use bundled Lodash/fp for JS and Toolz for Python;
do not invent equivalent collection libraries. Curried pipelines are useful when
they improve clarity; ordinary functions remain valid. No model runtime, generic
agent loop, MCP server or application framework belongs here.

The local dependencies are locked in vendor/LOCK.json. JS examples import
vendor/lodash/fp.js; Python package setup exposes vendor/toolz. Read
[dependencies](docs/dependencies.md) before changing imports. Keep licenses when
copying. Consumer projects can use their existing pinned dependency instead.

Check with `python3 -B tools/check.py`. Contributor lint/format instructions are
in [the pipeline](docs/pipeline.md). Fix behavior and rerun relevant checks; do not
mass-refactor unrelated host files. Report actual evidence and limitations.
Route graphics to visual-core, games to gaming-core and Git/publishing to
KakkoiSchool/ai-handbook. Integration into Pi remains a consumer task.
