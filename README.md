# Clippfy

The existing standalone design, connected to a Node/Vercel API and Supabase Auth, Postgres and private Storage.

## Run

Requires Linux x64 and Node 22+ (FFmpeg is provided by the platform-specific npm package).

```sh
npm ci
cp .env.example .env
# Fill the Supabase URL and publishable key. Never use a service-role key in the browser.
node --env-file=.env server.js
npm test
npm run build
```

Local server binds to `0.0.0.0:3000`. Vercel serves only the `public` build output; application source, environment files and tests are not static assets.

## Provisioning

1. Apply `supabase/migrations/202611200001_app.sql` to an empty Supabase project. It was applied to the connected Clippfy project on 20 November 2026.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Vercel. These are configured on `clippfyediting`. The app deliberately does not need a service-role key.
3. Email confirmation remains enabled. Set Auth site URL to `https://clippfyediting.vercel.app` and allow redirects to `/app` and `/reset` (already configured on the connected project). For production volumes, configure a custom SMTP provider in Supabase; its default mail service has restrictive delivery/rate limits.
4. Sign up as `ritam73592@gmail.com` and verify that email. The database checks the verified Auth identity for admin authorization, not user-editable metadata. Admin dashboard: `/admin`.
5. Optional: add `OPENAI_API_KEY` to the Vercel server environment and redeploy for Whisper transcription. Do not put it in frontend assets. Until configured, leave captions OFF; requests for automatic captions fail explicitly before processing.

## Working flow

- Sign up, verify email, sign in; session refresh uses HttpOnly, SameSite cookies. Recovery links are handled at `/reset`.
- Upload directly to a private Supabase bucket with a signed upload ticket, avoiding Vercel's request body limit.
- Generate 1–10 evenly spaced, non-overlapping excerpts; real FFmpeg vertical 720 × 1280 H.264/AAC MP4s and JPEG thumbnails.
- Source limit: 50 MB / 5 minutes. Output segments: up to 60 seconds. The free workspace allows 30 stored clips and approximately 500 MB. Delete projects to reclaim storage.
- View project progress, cancel, browse clips, download individually/all, copy available transcripts, update profile name, delete finished/failed projects.
- `/editor?job=UUID&clip=0` supports destructive trimming and a manual text overlay, with a fresh rendered downloadable MP4. Download a backup before editing.
- The admin dashboard lists members, recent project status/errors, and missing provider configuration.

## Explicit limitations / not configured

This is **not yet the complete commercial AI product described by the original offline marketing pages**. The original landing/pricing/legal copy has been preserved as requested and must be reviewed before accepting paying customers.

- Highlights are evenly spaced excerpts, not semantic AI-selected or virality-ranked moments. Scores are not fabricated.
- YouTube/Twitch/Kick/Drive/Dropbox URL ingestion and live streams need a separate, durable download/processing worker. The server rejects link imports and directs users to uploads.
- Transcription requires `OPENAI_API_KEY`. The current exporter provides static, grouped Anton captions in the selected basic color; the original advanced animated caption preview is illustrative and does not yet match all export controls.
- Paid checkout, subscriptions, trial offers and refunds are not connected. The workspace is explicitly free; no payment success is simulated. Google OAuth is hidden because no provider credentials exist.
- Profile email changes are currently rejected rather than silently changing an unverified identity. Name changes and password recovery are supported.
- Vercel's background function runtime is capped at 300 seconds. The UI marks abandoned jobs as failed after 6 minutes when retrieved. Large/high-resolution inputs may time out: retry shorter videos. Jobs do not survive infrastructure failure and there is no durable queue/retry scheduler yet.
- Cancellation is cooperative between FFmpeg stages. A currently running encode is not immediately killed. Per-request checks limit ordinary usage, but production billing requires transactional reservations/quotas, durable job locking, and rate limiting. Direct Supabase authenticated access is governed by ownership RLS; clip quota is not a payment entitlement boundary.
- Failed uploads that never become projects may leave private source objects. Add scheduled orphan cleanup before operating at scale. Admin API lists the most recent 100 users/projects.
- The bundled FFmpeg npm distribution is an older GPL build. Review codec licensing and replace with a maintained binary/container worker before a public commercial launch.

## Tests

`npm test` covers API unauthenticated/CSRF rejection, bounded rendering options, excerpt boundaries, caption escaping, real FFmpeg source generation/cropping/thumbnail rendering/text overlay/trimming, and DOM-based frontend boot/login/plans/settings/caption-step behavior with mocked API responses. These are not live email-delivery, OpenAI, payment, or real-browser end-to-end tests. The local Chromium check could not run because the sandbox lacks required shared libraries.
