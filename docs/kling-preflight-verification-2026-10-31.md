# BrandNMotion Kling verification — 2026-10-31 UTC

## Verified
- Main remains be236d0a9959ec46ffe239703bc3e465e69102f8.
- Production dpl_BvCPX2UcZ41jgFzC1JZVu2ECaBnz is READY, exact main commit; https://brandnmotion-studio.vercel.app.
- Live GET /api/engines returned HTTP 200, Kling configured=true, available=false, paidGenerationEnabled=false.
- Vercel metadata confirms sensitive production Kling_ai_key exists. No credential value retrieved or exposed.
- Local lint and production build pass. Existing five test files: 21/21 pass. Added isolated mocked Kling preflight suite: 7/7 pass. Includes disabled gate zero upstream calls, validation, exact five-second payload, completed URL, rate limit, authentication denial and missing job ID.
- Existing exact implementation-head browser regression run 41135573035 and build run 41135573021 succeeded. These use mocked provider behavior.
- No paid provider requests, purchases, billing changes or production code changes made in this verification.

## Not verified / blockers
- Stored credential presence is not authentication success. No direct authenticated provider request performed; sensitive Vercel key unavailable through metadata. Live endpoint gates status requests as well as creation while generation paused.
- Actual API account balance, model entitlement and exact direct-provider five-second price unverified. Public pricing fetch returned only a shell. Do not substitute Vercel Gateway pricing for this direct integration.
- Source lacks server-side owner authorization and spending limits. Do not publicly enable paid generation before those controls.
- No real Kling task, generated media, playable/downloadable output, reference-image continuity or final MP4 assembly verified. Current deployed route is text-to-video; sound off.
- Mock storyboard test called 'assembles MP4' checks an injected URL only, not actual encoding. File-store adapter test is local and not proof of live durable database storage.

## Next actions
1. Implement and verify server-side owner authorization and a bounded single-shot test path before enabling paid access.
2. Owner may need to sign into https://kling.ai/dev to verify API balance and direct price. Do not ask owner to re-enter a key just because metadata is insufficient.
3. Obtain explicit maximum credit/cost approval before one real five-second test, then verify provider job ID, completion, media playback/download and save media privately.

## Official references checked 2026-10-31
- https://kling.ai/document-api/guides/get-started/quick-start — developer resource packages and usage console.
- https://kling.ai/document-api/api/get-started/authentication — documented API-key Bearer format and Singapore API domain align with implementation. Indexed content accessible; direct page rendered shell.
- https://kling.ai/document-api/pricing/base/video — direct pricing inaccessible to this check; no cost claimed.

## Save scope
This report and test source are stored on the existing GitHub checkpoint branch backup/2026-10-30-live-integration. This is a code/report backup, not a backup of generated media, accounts or database. No unrelated local edits overwritten.
