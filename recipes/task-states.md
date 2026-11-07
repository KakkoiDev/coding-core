# Guard task state changes with a transition table

Write the allowed changes down as data: each state lists the events it accepts, the state each leads to and an
optional guard. `transition(table, state, event, context)` returns `{ ok: true, from, to, event }` or
`{ ok: false, error }` with a sentence the host can show; it never throws for an illegal change and never mutates.
`defineTransitions` validates a table once (unknown targets and non-function guards are refused) and freezes it.
`allowedEvents` lists what can happen next, which is what a UI or an agent should be offered.

`taskTransitions` is a ready table for todos: `pending → in_progress → done`, with `block`/`unblock`, `pause`,
`cancel` and `reopen`. Done is reachable only through `verify`, whose guard `hasEvidence` needs at least one
`{ kind: "test" | "artifact" | "receipt", ref }`. `start` waits for dependencies (`dependenciesDone` reads
`context.blockedBy`) and `block` needs a reason. The host builds the context from its store (which dependencies are
not done, whether a cited receipt exists) and persists the new state after the table allows it, in the same
transaction as the read (see [SQLite](sqlite.md)).

JavaScript implementation: [task states](../js/task-states.mjs). Unit cases: [JavaScript tests](../tests/recipes.test.mjs).
Python: the same table is a dict of dicts with guard functions; no Python module is shipped in v0.1.

## Scenarios (JavaScript only)

Their end-to-end tests are in [tests/e2e/scenarios.test.mjs](../tests/e2e/scenarios.test.mjs), named after the titles.

### Scenario: Move a todo from pending to done with evidence
Given a pending todo and the task transition table
When I start it and then verify it with a test as evidence
Then it is done
And reopening it makes it pending again
And the next events offered for a pending todo are start, block and cancel

### Scenario: An illegal or unguarded change is refused with a reason
Given the task transition table
When I verify a pending todo, verify an in-progress todo without evidence, or start a todo whose dependency is open
Then each change is refused
And the errors list the allowed events, ask for evidence, and name the open dependency

### Scenario: A table that leads to an unknown state is refused
Given a transition table where an event leads to a state that is not in the table
When I define it
Then I get an error that names the state and event
