# Scenarios

What each runnable recipe does for the person who calls it, in Given/When/Then. Each scenario is one end-to-end
test, named exactly after its title, in both languages:
[tests/e2e/scenarios.test.mjs](tests/e2e/scenarios.test.mjs) (`test('<title>', …)`) and
[tests/e2e/test_scenarios.py](tests/e2e/test_scenarios.py) (`def test_<title in snake case>`). An end-to-end test
runs a fresh consumer program in a scratch folder that imports the public module (`js/recipes.mjs`,
`js/effects.mjs`, `coding_core.recipes`, `coding_core.effects`) and checks what that program prints or writes.

The JavaScript-only scenario is in [recipes/concurrency.md](recipes/concurrency.md); the scenarios of the check and
build commands are in [docs/pipeline.md](docs/pipeline.md). `python3 -B tools/e2e.py` runs every e2e test and proves
each scenario's test ran and passed (vendored [test-core tools](tools/test-core/README.md)).

Adding a recipe: write its scenarios here first, then the two tests (red), then the code (green).
Removing one: remove its scenarios and their tests in the same commit, and say so in the message.

### Scenario: Normalize a list of users
Given users with padded names, upper-case emails, an inactive user and a repeated id
When I normalize the users
Then I get only the active users, once per id, sorted by name
And their names are trimmed and their emails are lower case
And the list I passed in is unchanged

### Scenario: Total the cents of each customer
Given order lines for two customers
When I total them by customer
Then I get one total in cents per customer

### Scenario: Index records by id
Given records where two share an id
When I index them by id
Then each id finds one record and the last duplicate wins

### Scenario: Split records into active and inactive
Given active records, inactive records and one without the flag
When I partition them by active
Then the active ones come first and every other record is in the second group

### Scenario: A valid user from outside is accepted and trimmed
Given a user object with a slug id and a padded name
When I validate it
Then it is accepted with the trimmed name and only the known fields

### Scenario: An invalid user from outside is refused with every reason
Given a user with an upper-case id and a blank name, and a value that is not an object
When I validate them
Then each is refused and the errors name every problem

### Scenario: Read settings from the environment
Given an environment with PORT 8080 and DEBUG 1
When I resolve the settings
Then the port is the number 8080 and debug is on
And an empty environment gives port 3000 with debug off

### Scenario: A bad PORT is refused
Given an environment whose PORT is not a number between 1 and 65535
When I resolve the settings
Then I get an error that says PORT must be 1..65535

### Scenario: Take one page of a collection
Given a collection of 45 items
When I ask for 20 items from offset 40
Then I get the last 5 items with the total, offset and limit

### Scenario: An out-of-range page size is refused
Given a collection
When I ask for a page with limit 0 or 101, or a negative offset
Then I get an error that says the allowed ranges

### Scenario: Total an order in integer cents
Given order lines with prices in cents and quantities
When I total the order
Then I get the exact total in cents

### Scenario: Fractional or negative cents are refused
Given an order line priced 0.1 or with a negative quantity
When I total the order
Then I get an error that asks for nonnegative integer cents and quantities

### Scenario: Apply events to a counter
Given a counter at 1
When I apply increment, increment, an unknown event and reset in turn
Then the counter reads 2, 3, 3 and 0 after each event
And the starting state is unchanged

### Scenario: Stamp a record with an injected clock
Given a record and a clock that always says 42
When I stamp the record
Then the new record has updatedAt 42 and the original has no updatedAt

### Scenario: Retry a transient failure until it succeeds
Given an operation that fails twice with a retryable error, then returns 9
When I retry it with an injected sleep
Then I get 9 after three attempts
And the sleeps grew from the first delay to double it

### Scenario: A permanent failure is not retried
Given an operation that fails with an error that is not retryable
When I retry it
Then that error reaches me after a single attempt and nothing slept

### Scenario: Replace a JSON file atomically
Given a scratch folder with data.json holding version 1
When I write version 2 to data.json atomically
Then data.json holds version 2 as indented JSON with a final newline
And the folder holds no temporary file
