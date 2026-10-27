# Durable production store

Use `fileStore` from `production/file-store.mjs` as the controller's injected `store` on a server with a persistent volume. Files use hashed keys, restrictive permissions, and temporary-file rename to avoid partial JSON replacement. Missing state returns undefined; corrupt state throws rather than silently regenerating paid shots. This adapter is single-writer; do not use it across concurrent workers. It is not a database or a cross-region backup. Back up the persistent volume separately. Ephemeral/serverless filesystem storage is not durable across instances.

Verification: 2026-10-27, `node --test production/*.test.mjs`: 9 passed. Existing generation/MP4 tests use simulated adapters; no real video generation or assembly was verified. The new test verifies recovery with a fresh store instance, arbitrary-key path confinement, and surfaced corruption.

Integration remains incomplete: the frontend/backend do not currently import the storyboard controller. Kling generation, real assembly, authenticated production routes and persistent-volume deployment must be wired and verified before claiming end-to-end readiness. No paid calls were made.
