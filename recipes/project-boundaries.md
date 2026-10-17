# Keep domain functions and effects separate

Put validation and data transformations in a small domain module. Pass data in,
return new values out. File/database/HTTP/clock calls live in a host adapter.
Use Lodash/fp and Toolz for useful compositions; ordinary functions and explicit
loops are appropriate when a pipeline hides control flow. Do not invent a generic
framework, blanket curry every function or force classes out of a host API.

Shallow copies do not make nested data immutable. Clone only the changed branch;
never mutate a record reached through an alias. Test the original nested input.
Avoid deep-merging untrusted keys into configuration objects. Pick allowed fields
and validate values. Validate at boundaries rather than repeatedly inside each
small domain transformation.

Resource lifetime must be explicit: Python `with`/`async with`, JavaScript
try/finally. Close resources owned by the function; do not close an injected
resource that belongs to the caller. The [atomic file recipes](atomic-json.md)
show cleanup on both success and failure.
