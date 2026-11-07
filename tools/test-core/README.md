# Vendored test-core tools

Copied unchanged from [KakkoiDev/test-core](https://github.com/KakkoiDev/test-core) at commit
`9906fb6b1c5a2bce138d6293b70afb60fe91fb1f` (branch `feat/recipes`). MIT licence: [LICENSE](LICENSE).
Standard library only; no download at test time.

- `scenarios.py`: every `### Scenario: <title>` (Given/When/Then lines) has one e2e test named after its title,
  and with `--junit` that test ran and passed.
- `flaky_lint.py`: no fixed sleeps, timers used as waits, focused tests, `networkidle` or real hosts in tests.
- `e2e_coverage.py`: every control on a page has an e2e step. coding-core has no pages, so it is vendored for
  consumers and not run here.

Update by copying the three files again from a newer test-core commit and changing the commit above.
