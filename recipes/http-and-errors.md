# HTTP and errors

Use the host HTTP client or standard fetch/urllib instead of adding a competing
client. Keep URL construction and response validation pure. Inject the client
into a small effect function; set an explicit timeout, cancellation behavior and
response-size limit. Check status before parsing, then validate parsed JSON.
Return domain errors at one boundary and retain the cause for diagnostics.
Do not log tokens, cookies or complete private payloads.

Use [bounded retries](retries.md) only for transient, idempotent requests. Never
turn every exception into success, retry forever or add live network access to a
unit test. Fake the client in tests and cover timeout, invalid JSON, status and
schema failures. This is guidance; no production HTTP client is shipped here.
