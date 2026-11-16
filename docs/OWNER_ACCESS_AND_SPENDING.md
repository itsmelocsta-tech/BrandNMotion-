# Owner access and zero-spend verification — 2026-11-15

## Implemented on fix/owner-access-zero-spend
- All Vercel provider endpoints and legacy backend /generate require a server-only BNM_OWNER_TOKEN (minimum 32 characters), checked with constant-time digest comparison.
- Owner token entry is password masked and held only in tab memory, never browser storage or production export JSON. Provider keys remain server-only.
- New video submissions fail closed with ZERO_SPEND_LIMIT even if ENABLE_PAID_VIDEO_GENERATION=true or the client supplies approval/budget fields. Approved video budget remains $0.
- Engine configuration is distinct from availability; configured does not mean credential acceptance.
- Owner-only GET /api/provider-status lists Google models without generating content. Successful listing is not evidence of generation access, billing balance, pricing, or playable output.
- Added npm lockfile for reproducible frontend installs.

## Validation
21 Node tests passed. TypeScript + Vite production build passed. ESLint passed. No live provider generation was requested and no charges were intentionally initiated.

## Remaining release requirements
Vercel environment metadata inspected: Google and Kling credential entries exist; BNM_OWNER_TOKEN does not. A secure owner secret must be provisioned server-side and delivered through an appropriate owner credential workflow before deployment. Never commit it, put it in VITE_ variables, URLs, or saved browser data.

This branch has not been merged or deployed to production. Existing live deployment does not receive these changes until release. Provider credential acceptance, API credit balance, current exact per-request cost, and real generated-video playback remain unverified. No paid-generation approval exists.

Paid operation must remain blocked until a durable atomic server ledger reserves each approved quote, enforces per-owner quotas/rate limits and idempotency, and audits/reconciles provider jobs. An environment flag or browser checkbox is insufficient. This patch enforces the existing $0 budget; it does not implement a positive-budget billing service.
