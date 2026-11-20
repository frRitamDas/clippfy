// Install the pinned standalone Linux executable (includes Python) into the server bundle.
// It is never copied into the public/static directory. Verify every byte before execution.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { VERSION, SHA256, DEFAULT_BINARY } = require('../lib/downloader');
async function install() {
  const valid = async () => {
    try { return crypto.createHash('sha256').update(await fs.readFile(DEFAULT_BINARY)).digest('hex') === SHA256; }
    catch { return false; }
  };
  if (!await valid()) {
    console.log(`Installing verified yt-dlp ${VERSION} standalone worker…`);
    const response = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}/yt-dlp_linux`, {signal:AbortSignal.timeout(90000)});
    if (!response.ok) throw new Error(`yt-dlp installation failed (${response.status})`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > 70*1024*1024 || crypto.createHash('sha256').update(body).digest('hex') !== SHA256) throw new Error('yt-dlp SHA-256 verification failed');
    await fs.mkdir(path.dirname(DEFAULT_BINARY),{recursive:true});
    await fs.writeFile(DEFAULT_BINARY+'.tmp',body,{mode:0o755});
    await fs.rename(DEFAULT_BINARY+'.tmp',DEFAULT_BINARY);
  }
  await fs.chmod(DEFAULT_BINARY,0o755);
  const version=execFileSync(DEFAULT_BINARY,['--version'],{timeout:15000,encoding:'utf8'}).trim();
  if(version!==VERSION)throw new Error('Unexpected yt-dlp runtime version');
  console.log(`Download worker ready: yt-dlp ${version}`);
}
if(require.main===module)install().catch(error=>{console.error(error.message);process.exit(1);});
module.exports={install};
