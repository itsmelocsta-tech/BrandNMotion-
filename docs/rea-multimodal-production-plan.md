# BrandNMotion / Director Pro: REA-assisted multimodal production plan

Status: repository and production flow inspected 2026-10-30. REA is not installed or executed; this document does not claim provider integrations are operational.

## Existing implementation (verified)
- `frontend/src/productionController.ts`: 1–8 text-prompt shots, Kling/Veo/Runway selection, persisted job IDs, resume and retry safety.
- `frontend/api/engines.js`: text-to-video provider requests only; no source-image or talking-photo payload.
- `frontend/src/App.tsx`: treatment, shot planning, video clip editor, cost approval and local progress restoration.
- Provider submissions are blocked unless `ENABLE_PAID_VIDEO_GENERATION=true`. Keep disabled until explicit user approval.

## Target workflows
1. Upload a reference image; validate type, size, consent/rights; show preview; choose image-to-video. Preserve source across all shots.
2. Upload character portrait + script or authorized voice; route to talking-avatar/lip-sync provider; retain character identity.
3. Upload storyboard images; derive ordered shot plan with shot durations and consistent reference assets.
4. Provider-independent capabilities: text_to_video, image_to_video, talking_photo, lip_sync, first_last_frame, reference_character. Show only verified capabilities, not speculative provider support.
5. Create drafts and provider jobs only after cost estimate and explicit approval. Never silently spend credits.
6. Preserve job IDs and uploads securely; retry polling, not paid submissions with uncertain outcomes; export ordered clips and soundtrack.

## REA usage constraints
- Inspect authorized open-source reference implementations and public API documentation, not proprietary client code or credentials.
- REA must run in a supported development environment after dependency review. No runtime installation is evidenced by this commit.
- Record upstream license, reference project, behavior studied, and original implementation decisions.

## Engineering sequence
A. Add typed media asset and provider capability contracts, with tests for unsupported mode and missing image.
B. Implement secure temporary image upload or signed media URL handling; reject arbitrary URLs and private hosts.
C. Implement Kling image-to-video adapter first, separate from text-to-video.
D. Implement optional talking-photo adapter with capability and cost gates.
E. Add storyboard shot planning with reference continuity and job persistence.
F. End-to-end tests with mocked providers and zero paid submissions; phone browser QA.
G. Preview deployment and human verification before production merge.

## Acceptance
- A photo can be uploaded and previewed; the shot plan references it.
- A talking-photo request cannot be routed to a text-only provider.
- All cost gates stay closed by default; no unapproved generation occurs.
- Failed or interrupted jobs resume without duplicate paid requests.
- The UI accurately reports missing credentials, provider support and generation status.
