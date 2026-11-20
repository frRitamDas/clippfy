# Clippfy: free-tier setup and YouTube troubleshooting

## What requires a key?

- Clipping/cropping/thumbnails/MP4 export: FFmpeg already included, no paid API key.
- YouTube download: yt-dlp already included, no API key. YouTube can refuse the hosting IP; a transcription key will NOT fix this. The YouTube Data API returns metadata, not downloadable source videos.
- Captions: Groq free-tier Whisper integration is included. Free tiers have quotas and can change; check your own account limits. No automatic OpenAI fallback is used.
- Auth/database/private storage: existing Supabase project remains connected. Check its plan and usage separately; this code does not change your subscription.
- Hosting: existing Vercel setup remains. Free compute/storage/network allowances are not unlimited. Check the host's terms for your use case.
- Paid checkout: not configured. The restored $1 trial banner is marked coming soon. No payments are collected.
- AI highlight ranking: not implemented. Current clips are evenly spaced excerpts; a transcription key adds captions, not automatic viral scoring.

## 1. Enable free-tier captions with Groq

1. Open https://console.groq.com and create your own account.
2. Open **API Keys**: https://console.groq.com/keys and create a key.
3. In **Vercel → clippfyediting → Settings → Environment Variables**, add:

   ```text
   TRANSCRIPTION_PROVIDER=groq
   GROQ_API_KEY=<your key, entered in Vercel only>
   ```

   Choose Production (and Preview if desired). Mark the key sensitive/encrypted. Never use `NEXT_PUBLIC_` or put the key in HTML, Git, screenshots, or chat.
4. Redeploy. Having an `OPENAI_API_KEY` alone no longer enables paid requests. You can remove it from your project's environment yourself if not needed. To explicitly opt into paid OpenAI you must choose `TRANSCRIPTION_PROVIDER=openai`.
5. Sign in, upload a short spoken video, enable captions, generate one clip, and check the exported video. Then test another supported language if needed. The integration has automated mock tests; a real Groq transcription has not been verified until your key is configured and this test succeeds.
6. Check quotas at https://console.groq.com/settings/limits. HTTP 429 means wait for quota reset or disable captions. The app will not switch to a paid provider automatically.
7. If using a separate worker, put the same two variables on **that worker** too, and restart it. Vercel only reports its own configuration; it cannot confirm the remote worker's key.

Provider docs: https://console.groq.com/docs/speech-to-text and https://console.groq.com/docs/rate-limits . Groq receives your extracted audio when captions are enabled; review its data policies before uploading sensitive content.

## 2. Why YouTube import currently fails

A real test from Vercel returned **“Sign in to confirm you’re not a bot.”** The executable installed and ran; YouTube refused the network request. This is not an OpenAI issue. Retrying the same blocked host or adding a YouTube Data API key does not establish download access.

Practical options:

1. **Available now:** upload your own video file (up to 50 MB; no fixed source-duration cap, but execution limits apply), then generate clips. This avoids the YouTube download request entirely.
2. **Use the existing separate worker:** deploy `worker/Dockerfile` on a server/network you control, with the same Supabase URL and publishable key. See README for build/run commands. After it has a trusted HTTPS URL, set `DOWNLOAD_WORKER_URL` on Vercel and redeploy. Test an actual import before relying on that host; other datacenter IPs can also be blocked.
3. **For testing without renting a server:** run the worker on your own Linux x64 machine with Docker, using your own internet connection. Expose it only through a trusted HTTPS tunnel you configure, then set that tunnel's URL as `DOWNLOAD_WORKER_URL`. Your machine and tunnel must remain running, and tunnel URLs may change. This is a testing arrangement, not reliable public production hosting, and YouTube may still refuse it. Don't put localhost in Vercel's environment; localhost there refers to Vercel, not your computer.

The worker validates Supabase user JWTs and ownership, but any publicly reachable service still needs host-level abuse protection and monitoring. Don't publish browser cookies or YouTube account credentials. Only process content you own or have permission to use. There is no guarantee that every public link will be downloadable, and private/live/age-restricted videos remain unsupported.

## 3. Verify before calling the site ready

- Create/sign into a verified account.
- Upload a short MP4 with captions disabled and download the generated clip.
- Configure Groq; repeat with speech and captions enabled.
- Check the restored $1 banner says coming soon and does not claim to collect payments.
- If deploying a separate worker, verify `/health`, then submit a real YouTube project from the signed-in website. A healthy endpoint is not proof of a successful download.
- Review Supabase storage, provider limits, and hosting usage. Free-tier is not unlimited/free forever.
