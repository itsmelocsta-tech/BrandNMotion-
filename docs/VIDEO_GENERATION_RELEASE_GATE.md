# BrandNMotion video generation release gate

Status: NOT LIVE-VERIFIED. This document is the audited handoff; it does not enable paid video generation.

## Verified
- Vercel project brandnmotion-studio exists and latest production deployment was READY when inspected.
- GEMINI_API_KEY entries are configured in Vercel environments; actual Google authentication is unverified.
- Local experimental gateway unit tests: 4 passed, 0 failed on 2026-10-24.
- Existing experimental gateway is local-only, requires bearer token, explicit approval and BNM_PAID_GENERATION_ENABLED=true.

## Release blockers
- Confirm Google billing status using an authorized Google Cloud account.
- Authenticate against Google's live API server-side without disclosing the API key.
- List supported video models and confirm current documented model ID and schema.
- Do not assume gemini-omni-1.1-flash or /v1beta/interactions supports video; this is an unverified experimental adapter.
- Implement authenticated production endpoint, user quotas, rate limiting, server-side approval and audit records.
- After explicit charge approval, perform live generation, poll operation, download and validate MP4, and test playback/export.
- Verify production deployment and end-to-end regression tests before announcing readiness.

## Spending safety
Never enable paid generation by default or expose GEMINI_API_KEY in browser/mobile code. Never initiate a charge merely to test credentials.
