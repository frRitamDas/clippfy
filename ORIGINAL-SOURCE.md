# Uploaded original source restoration

The user-supplied `index-2.html` is the landing page (`index.html`). Supplied app,
pricing, privacy and refund pages are the page source of truth. All 15 supplied
CSS/JS assets are stored byte-for-byte at their original `assets/` paths; their
SHA-256 hashes are regression-tested in `test/original-assets.json`.

Intentional page integration changes:
- Script references use `assets/integration/` for existing working Studio API,
  authentication, direct-storage upload and quota/slider fixes; original
  `13_app.js` remains untouched as supplied.
- Offer script uses the user-approved labelled, session-persistent 20-minute demo
  countdown, not a real purchase deadline or checkout.
- Landing runtime uses the uploaded review photos, initializes the marquee once,
  and animates community figures to fixed user-specified values, not invented
  ongoing activity. Preview information is linked from the footer.
- Pricing runtime retains explicit annual billing totals and backend-aligned prices;
  paid checkout remains unavailable and is disclosed.
- App upload hint states no fixed application upload cap instead of the original 8 GB claim; workspace quotas, Supabase per-file restrictions and processing limits remain. YouTube downloads retain a separate 50 MB bound.
- Previous custom landing CSS/font/layout overrides are no longer loaded.

No backend/admin functionality has been rolled back. YouTube URL support is wired
but production download success is NOT established: the latest Vercel live smoke
test encountered YouTube's bot challenge. Upload is the fallback. A reachable,
authorized processing worker/network that YouTube accepts is still needed for
reliable direct imports; source restoration alone does not resolve that block.
