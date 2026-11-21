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
5. Optional: add `GROQ_API_KEY` and `TRANSCRIPTION_PROVIDER=groq` to the Vercel server environment and redeploy for free-tier Whisper transcription (subject to provider quotas). See [FREE_SETUP.md](FREE_SETUP.md). Do not put it in frontend assets. Until configured, leave captions OFF; requests for automatic captions fail explicitly before processing.

## Working flow

- Sign up, verify email, sign in; session refresh uses HttpOnly, SameSite cookies. Recovery links are handled at `/reset`.
- Paste a public, recorded YouTube watch/Shorts/youtu.be URL. The background worker validates it, checks metadata, downloads up to 480p, persists the source privately, then runs the same clipping pipeline. Sources must be at most 50 MB; there is no default source-duration cap, but execution limits apply. Only import videos you own or have permission to use.
- Or upload directly to a private Supabase bucket with a signed upload ticket, avoiding Vercel's request body limit.
- Generate 1–10 evenly spaced, non-overlapping excerpts; real FFmpeg vertical 720 × 1280 H.264/AAC MP4s and JPEG thumbnails.
- Uploaded sources have no default application byte cap. Set `MAX_UPLOAD_BYTES` to a positive byte count to impose one. Workspace quotas and the Supabase project/bucket per-file limits still apply; removing the app cap does not raise those provider limits. Very large sources may exceed worker memory, disk or execution time. YouTube downloads retain a separate 50 MB safety bound. No fixed duration cap (execution limits apply). Output segments: up to 60 seconds. The free workspace allows 30 stored clips and approximately 500 MB. Delete projects to reclaim storage.
- View project progress, cancel, browse clips, download individually/all, copy available transcripts, update profile name, delete finished/failed projects.
- `/editor?job=UUID&clip=0` supports destructive trimming and a manual text overlay, with a fresh rendered downloadable MP4. Download a backup before editing.
- The admin dashboard lists members, recent project status/errors, and missing provider configuration.

## Explicit limitations / not configured

This is **not yet the complete commercial AI product described by the original offline marketing pages**. The original landing/pricing/legal copy has been preserved as requested and must be reviewed before accepting paying customers.

- Highlights are evenly spaced excerpts, not semantic AI-selected or virality-ranked moments. Scores are not fabricated.
- YouTube import is implemented, but **not every YouTube URL can work**: private, age-restricted, members-only, region-restricted, live and upcoming videos are rejected. YouTube can block cloud/datacenter IPs, including Vercel. Bot/sign-in/403/429 failures are surfaced explicitly with an upload fallback; no account cookies or access-control bypasses are used. Other websites and playlists are not supported.
- Long recordings still need a dedicated, long-running processing service rather than the bounded Vercel worker. No external always-on worker hosting account has been provisioned.
- Transcription supports Groq free-tier (`GROQ_API_KEY`, `TRANSCRIPTION_PROVIDER=groq`). Paid OpenAI requires an explicit `TRANSCRIPTION_PROVIDER=openai`; it is never selected automatically. The current exporter provides static, grouped Anton captions in the selected basic color; the original advanced animated caption preview is illustrative and does not yet match all export controls.
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

`worker/Dockerfile` and `worker/server.js` provide a portable worker for a container/VPS host **you provision**. This repository does not create a new hosting account or spend money on a server. The container adapter changes where the job executes; it does not raise the 50-MB YouTube download or 265-second processing limits, add a durable retry queue, or guarantee YouTube will accept that host's network.

```sh
docker build -f worker/Dockerfile -t clippfy-worker .
docker run --rm -p 8080:8080 \
  -e SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  -e SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY \
  clippfy-worker
```

1. Deploy that image behind an HTTPS URL on your chosen host, using the same Supabase project as the website. Put `TRANSCRIPTION_PROVIDER=groq` and `GROQ_API_KEY` in that host's secret environment too if you want free-tier captions there. No Supabase service-role key is needed.
2. Check the host's `/health` endpoint. It reports downloader version, active jobs and capacity (two jobs per container).
3. Set `DOWNLOAD_WORKER_URL=https://YOUR_WORKER_HOST/` in Vercel and redeploy the website. The frontend continues to call only same-origin `/api/jobs`; the API forwards the authenticated user's short-lived Supabase JWT server-to-server. HTTPS redirects are refused, so JWTs are not forwarded to another origin.
4. The container independently validates the JWT with Supabase, checks job ownership via RLS, and claims only queued jobs. Saturated/unreachable workers produce explicit errors rather than silently leaving a spinner forever. SIGTERM stops new dispatches and waits for current work to finish.
5. Test an actual signed-in YouTube project from this host. Vercel's build-time smoke test still reports **Vercel build egress**, not your separate worker's network. Do not treat an installed binary, healthy HTTP endpoint, or mock-based tests as a successful YouTube download.

**Observed deployment result (20 November 2026):** yt-dlp installed and launched successfully on Vercel, but YouTube rejected the current upstream test fixture with “Sign in to confirm you’re not a bot.” The built-in import path is implemented; successful live YouTube ingestion has **not** been established on that hosting network. Uploads remain the fallback. A different host may also be blocked; test before committing to it.

## Admin access and source-duration update

The default application source-duration ceiling is now removed (upload and YouTube metadata paths). Set `MAX_SOURCE_SECONDS` to a positive number on API/worker hosts if you want a specific ceiling. This **does not** remove Vercel's 300-second execution ceiling, the current 265-second processing budget, per-download timeout, storage-provider per-file limits, captions provider quotas, or cloud YouTube blocks. Large videos can still fail for those reasons. This is not an unlimited-processing promise.

Apply `supabase/migrations/202611200002_entitlements.sql` for manual access management. The verified database account `ritam73592@gmail.com` has uncapped *workspace* project/clip/storage quotas in the application; batch work stays at 1–10 clips, and provider/storage/processing limits still apply. Sign in and open `/admin` to grant Starter/Clipper/Pro access by verified registered email, optionally with an expiry. Select Free to revoke. These are complimentary manual entitlements, not paid or auto-renewing subscriptions. Grants do not create administrators. Each change is audited. Members cannot directly write access/audit tables or bypass the admin-checked RPC. Expired grants revert to free quotas on the next request without deleting existing files.

Current plans count stored clips rather than monthly generation credits: Free 30 / 500 MB, Starter 30 / 1 GB, Clipper 100 / 5 GB, Pro 300 / 10 GB. Admin grants do not upgrade your Supabase hosting plan. Quota checks are not a transactional reservation system; keep the single-active-project guard and monitor storage usage.

### Storage display
The dashboard and Settings show tracked project storage (source videos plus generated clip bytes), capacity and remaining space. Admins have no application quota, not unlimited provider storage. Usage refreshes when returning home, on project changes and periodically. Unattached/orphaned uploads are not included in project totals. Deleting stored projects frees tracked space.

### Plan-based storage
Storage allowances are derived from `assets/plans.json` for Starter, Creator (`clipper`) and Pro; Free retains 500 MiB. The billing API reports the actual assigned plan rather than a hardcoded Starter label. Upload admission and generated/edited clip growth use the combined stored source + clip total. The dashboard labels the assigned plan. There is no default 50-MiB uploaded-file application cap; a file must fit in the remaining plan space. The separate YouTube download bound is unchanged.

The production `videos` bucket's explicit 52,428,800-byte file limit was removed on 2026-11-20 (`file_size_limit = null`). This inherits the Supabase project's global file-size ceiling, not unlimited provider capacity. That global ceiling has not been changed or verified by this connector; uploads over 50 MiB still require end-to-end verification and may require a provider-plan/configuration change. Quota checks are not transactional reservations and tracked totals exclude orphan uploads and thumbnails.

### AI Script Studio (replaces the removed publishing kit)
Open `/app#scripts` or **AI Scripts** in the sidebar. Enter a topic/source notes, audience, tone, target duration (15/30/60 seconds) and language. Generate three hook ideas, three titles, narration, shot suggestions, a description and hashtags. Edit the narration, inspect approximate spoken time, copy text or download a `.txt` draft. This generates text, not video. Drafts are held in page memory only, cleared at sign-out and lost on refresh; download to keep them. The rejected publishing-kit UI, exports and metadata API have been removed.

The authenticated `/api/scripts/generate` endpoint calls only `https://api.groq.com/openai/v1/chat/completions`, using the open-weight `openai/gpt-oss-20b` model hosted by **Groq**, not OpenAI's API. It uses the existing server-only `GROQ_API_KEY`. There is no OpenAI API fallback, automatic retry, search tool, arbitrary provider endpoint or autonomous background generation. `SCRIPT_GENERATION_ENABLED=false` disables generation. Input/output lengths, model, completion budget (2,500 tokens) and request timeout (40 seconds) are bounded. The per-instance guard allows one in-flight request and three attempts per user/minute; it is best-effort, not distributed across Vercel instances. Groq's organization-level quotas remain authoritative and are shared with other Groq use.

Groq offers a quota-limited free tier; open weights do **not** mean unlimited free hosted compute. Keep the provider account on its Free plan if zero API spend is required. This application cannot inspect or guarantee the billing tier of a supplied key. No billing tier is upgraded by this feature. Official model availability and quotas: https://console.groq.com/docs/models and https://console.groq.com/docs/rate-limits (checked 2026-11-20). Llama models are currently listed as enterprise-only, so they are not selected. Review your account's exact limits at https://console.groq.com/settings/limits.

Prompts are sent to Groq; do not submit confidential material. Returned drafts need fact-checking and rights review and carry no virality guarantee. Provider failures/quotas are shown without discarding the last successful draft. Tests mock the provider and browser generation results; a live generation with the production account has not yet been verified.

### Shared Clippfy UI
All HTML pages load `assets/clippfy-ui.css`, which reuses the original dark Studio tokens, Geist/Montserrat typography, lime actions, charcoal surfaces and raised buttons. Both fonts are bundled locally. Original uploaded CSS/JS remain byte-identical; new components extend the foundation rather than editing those files. Landing/pricing/legal content and layouts are retained.

AI Script Studio now uses a branded brief/result workspace, labelled example artwork (not a generated claim), input character count, generation steps and a real request-bound loading state with reduced-motion support. The editor, account recovery, service status and preview disclosure use the shared standalone header, fields, panels, navigation and footer. Their existing functional IDs/API behavior are preserved. The extensionless original font stylesheet is served as `text/css` in both local Express and Vercel. Browser checks cover 17 routes at desktop/mobile with mocked authenticated data and no horizontal overflow; this is not a new live AI/provider processing verification.
