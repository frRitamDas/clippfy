# Clippfy

The existing standalone design, connected to a Node/Vercel API, an isolated yt-dlp YouTube download worker, and Supabase Auth, Postgres and private Storage.

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
- Paste a public, recorded YouTube watch/Shorts/youtu.be URL. The background worker validates it, checks metadata, downloads up to 480p, persists the source privately, then runs the same clipping pipeline. Sources must be at most 5 minutes and 50 MB. Only import videos you own or have permission to use.
- Or upload directly to a private Supabase bucket with a signed upload ticket, avoiding Vercel's request body limit.
- Generate 1–10 evenly spaced, non-overlapping excerpts; real FFmpeg vertical 720 × 1280 H.264/AAC MP4s and JPEG thumbnails.
- Source limit: 50 MB / 5 minutes. Output segments: up to 60 seconds. The free workspace allows 30 stored clips and approximately 500 MB. Delete projects to reclaim storage.
- View project progress, cancel, browse clips, download individually/all, copy available transcripts, update profile name, delete finished/failed projects.
- `/editor?job=UUID&clip=0` supports destructive trimming and a manual text overlay, with a fresh rendered downloadable MP4. Download a backup before editing.
- The admin dashboard lists members, recent project status/errors, and missing provider configuration.

## Explicit limitations / not configured

This is **not yet the complete commercial AI product described by the original offline marketing pages**. The original landing/pricing/legal copy has been preserved as requested and must be reviewed before accepting paying customers.

- Highlights are evenly spaced excerpts, not semantic AI-selected or virality-ranked moments. Scores are not fabricated.
- YouTube import is implemented, but **not every YouTube URL can work**: private, age-restricted, members-only, region-restricted, live and upcoming videos are rejected. YouTube can block cloud/datacenter IPs, including Vercel. Bot/sign-in/403/429 failures are surfaced explicitly with an upload fallback; no account cookies or access-control bypasses are used. Other websites and playlists are not supported.
- Long recordings still need a dedicated, long-running processing service rather than the bounded Vercel worker. No external always-on worker hosting account has been provisioned.
- Transcription requires `OPENAI_API_KEY`. The current exporter provides static, grouped Anton captions in the selected basic color; the original advanced animated caption preview is illustrative and does not yet match all export controls.
- Paid checkout, subscriptions, trial offers and refunds are not connected. The workspace is explicitly free; no payment success is simulated. Google OAuth is hidden because no provider credentials exist.
- Profile email changes are currently rejected rather than silently changing an unverified identity. Name changes and password recovery are supported.
- Vercel's background function runtime is capped at 300 seconds. The UI marks abandoned jobs as failed after 6 minutes when retrieved. Large/high-resolution inputs may time out: retry shorter videos. Jobs do not survive infrastructure failure and there is no durable queue/retry scheduler yet.
- Cancellation is checked every 2.5 seconds during processing and kills the active downloader/FFmpeg process. Jobs are claimed with an atomic queued-to-running database condition; cancellation-aware updates do not overwrite the cancelled status. Per-request checks limit ordinary usage, but production billing requires transactional reservations/quotas, durable job locking, and rate limiting. Direct Supabase authenticated access is governed by ownership RLS; clip quota is not a payment entitlement boundary.
- Failed uploads that never become projects may leave private source objects. Add scheduled orphan cleanup before operating at scale. Admin API lists the most recent 100 users/projects.
- The bundled FFmpeg npm distribution is an older GPL build. Review codec licensing and replace with a maintained binary/container worker before a public commercial launch.

## Tests

`npm test` covers API unauthenticated/CSRF rejection, bounded rendering options, excerpt boundaries, caption escaping, real FFmpeg source generation/cropping/thumbnail rendering/text overlay/trimming, and DOM-based frontend boot/login/plans/settings/YouTube-submit behavior with mocked API responses. Downloader tests cover host/URL validation, metadata limits, child-process argument isolation, oversized/missing output, cancellation, timeouts and actionable error classification. These are not live email-delivery, OpenAI, payment, or real-browser end-to-end tests. The local Chromium check could not run because the sandbox lacks required shared libraries.

## YouTube worker deployment and verification

`npm run build` installs the pinned official `yt-dlp_linux` standalone executable (Python and EJS support included) into ignored `vendor/`. Its SHA-256 digest is pinned in `lib/downloader.js` and verified before execution. No executable, video, or metadata cache is copied into `public/`. The Vercel function explicitly bundles the executable alongside FFmpeg and fonts. Update the version **and** the release digest together when YouTube changes extraction requirements.

The worker runs without a shell, ignores system/user yt-dlp configuration, disables playlists, cache and remote component loading, uses the deployed Node runtime for YouTube's JavaScript support, and receives no application API secrets in its child environment. It limits metadata extraction to 30 seconds, download to 90 seconds, and the whole job to 265 seconds, before Vercel's 300-second hard limit. Downloads are monitored for unknown-size/partial-file growth as well as yt-dlp's own maximum-size setting. The worker stores an actionable error code, not raw extractor logs or credentials.

Each Vercel build runs `scripts/smoke-youtube.js`: download yt-dlp's public test fixture and render a one-second vertical MP4. The result is exposed on `/status.html` through `/api/health` as `youtubeSmoke`. A failed external test does **not** prevent deploying the working upload fallback, and an installed worker is never reported as a successful YouTube test. A successful build-machine test is not proof that Lambda's different egress IP will be accepted. A signed-in production YouTube project remains the definitive runtime end-to-end check.

For local use, install a compatible yt-dlp executable and set `YTDLP_PATH` to its absolute path, or run `node scripts/install-downloader.js` to fetch the verified standalone version. For offline/local static-build tests only, `SKIP_DOWNLOADER_INSTALL=1 npm run build` skips this download; Vercel ignores that bypass and always installs/verifies its binary. The local sandbox cannot reach YouTube, so downloader network tests run from Vercel rather than being falsely reported as local successes.

## Optional separate container worker

`worker/Dockerfile` and `worker/server.js` provide a portable worker for a container/VPS host **you provision**. This repository does not create a new hosting account or spend money on a server. The container adapter changes where the job executes; it does not yet raise the 5-minute/50-MB source limits, add a durable retry queue, or guarantee YouTube will accept that host's network.

```sh
docker build -f worker/Dockerfile -t clippfy-worker .
docker run --rm -p 8080:8080 \
  -e SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  -e SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY \
  clippfy-worker
```

1. Deploy that image behind an HTTPS URL on your chosen host, using the same Supabase project as the website. Optional `OPENAI_API_KEY` belongs in that host's secret environment too if you want automatic captions there. No Supabase service-role key is needed.
2. Check the host's `/health` endpoint. It reports downloader version, active jobs and capacity (two jobs per container).
3. Set `DOWNLOAD_WORKER_URL=https://YOUR_WORKER_HOST/` in Vercel and redeploy the website. The frontend continues to call only same-origin `/api/jobs`; the API forwards the authenticated user's short-lived Supabase JWT server-to-server. HTTPS redirects are refused, so JWTs are not forwarded to another origin.
4. The container independently validates the JWT with Supabase, checks job ownership via RLS, and claims only queued jobs. Saturated/unreachable workers produce explicit errors rather than silently leaving a spinner forever. SIGTERM stops new dispatches and waits for current work to finish.
5. Test an actual signed-in YouTube project from this host. Vercel's build-time smoke test still reports **Vercel build egress**, not your separate worker's network. Do not treat an installed binary, healthy HTTP endpoint, or mock-based tests as a successful YouTube download.

**Observed deployment result (20 November 2026):** yt-dlp installed and launched successfully on Vercel, but YouTube rejected the current upstream test fixture with “Sign in to confirm you’re not a bot.” The built-in import path is implemented; successful live YouTube ingestion has **not** been established on that hosting network. Uploads remain the fallback. A different host may also be blocked; test before committing to it.
