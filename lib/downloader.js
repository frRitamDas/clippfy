// Isolated, bounded YouTube download worker. Only canonical single-video URLs reach yt-dlp.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { fail, MAX_BYTES } = require('./backend');
const VERSION = '2026.10.26';
const SHA256 = '767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795';
const DEFAULT_BINARY = path.resolve(__dirname, '../vendor/yt-dlp_linux');
function binaryPath() { return process.env.YTDLP_PATH || DEFAULT_BINARY; }
function smokeResult() { try { return JSON.parse(fs.readFileSync(path.resolve(__dirname,'../vendor/youtube-smoke.json'),'utf8')); } catch { return null; } }
function available() { try { fs.accessSync(binaryPath(), fs.constants.X_OK); return true; } catch { return false; } }
function youtubeURL(value) {
  if (typeof value !== 'string' || value.length > 2048) throw fail('Paste a single YouTube video URL.');
  let url;
  try { url = new URL(value.trim()); } catch { throw fail('Paste a valid YouTube video URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw fail('Use a standard YouTube video URL.');
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id;
  if (host === 'youtu.be' && parts.length === 1) id = parts[0];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (parts.length === 2 && ['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1];
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) throw fail('Use a single YouTube watch, Shorts or youtu.be link. Playlists and other websites are not supported.');
  return `https://www.youtube.com/watch?v=${id}`;
}
function classifyWorkerError(stderr) {
  if (/sign in|not a bot|429|403|confirm your age|login required|cookies|po.token/i.test(stderr))
    return Object.assign(fail('YouTube blocked this server or requires sign-in. Upload the video file instead. Private, age-restricted and region-restricted videos cannot be imported.', 422), {code:'yt_blocked'});
  if (/private video|video unavailable|not available|removed|copyright|members.only/i.test(stderr))
    return Object.assign(fail('This YouTube video is unavailable or restricted. Upload an accessible video you have permission to use.', 422), {code:'yt_unavailable'});
  if (/max.filesize|larger than|file.*size|too large/i.test(stderr)) return Object.assign(fail('The YouTube download exceeds 50 MB. Try a shorter video or upload a smaller file.', 422), {code:'source_limit'});
  return Object.assign(fail('The YouTube download failed. The video may be restricted, or YouTube may be blocking cloud downloads. Try again later or upload the file.', 422), {code:'yt_download_failed'});
}
function workerError(stderr) {
  const error=classifyWorkerError(stderr);
  // Build-time diagnosis only. Never persist this field or return it through the API.
  error.diagnostic=String(stderr).split('\n').filter(line=>/^ERROR:/.test(line)).slice(-2).join(' ').replace(/https?:\/\/\S+/g,'[url]').slice(0,700);
  return error;
}
function validateMetadata(meta) {
  if (meta._type === 'playlist' || !meta.id || !Number.isFinite(meta.duration) || meta.duration < 0.5 || meta.duration > 300)
    throw Object.assign(fail('Choose one recorded YouTube video up to 5 minutes long. Longer videos need a dedicated long-running worker.', 422), {code:'source_limit'});
  if (meta.is_live || meta.is_upcoming || ['is_live', 'is_upcoming', 'post_live'].includes(meta.live_status))
    throw Object.assign(fail('Live or still-processing streams are not supported. Try a completed recording.', 422), {code:'yt_live'});
  if (meta.age_limit > 0 || ['private','premium_only','subscriber_only','needs_auth'].includes(meta.availability))
    throw workerError('login required');
  return meta;
}
function command(args, { dir, timeout = 90000, signal, spawnProcess = spawn } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason||fail('Cancelled', 409));
    let child, out = '', err = '', settled = false, timer, monitor;
    const finish = (error, value) => {
      if (settled) return; settled = true;
      clearTimeout(timer); clearInterval(monitor); signal?.removeEventListener('abort', abort);
      if (error) { if(child?.pid){try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}}else child?.kill('SIGKILL'); reject(error); } else resolve(value);
    };
    const abort = () => finish(signal.reason||fail('Cancelled',409));
    try {
      child = spawnProcess(binaryPath(), args, { cwd:dir, shell:false, detached:process.platform!=='win32', stdio:['ignore','pipe','pipe'], env:{PATH:process.env.PATH,HOME:dir||'/tmp',TMPDIR:dir||'/tmp',LANG:'C.UTF-8',LD_LIBRARY_PATH:process.env.LD_LIBRARY_PATH||''} });
    } catch (error) { return finish(error); }
    signal?.addEventListener('abort', abort, {once:true});
    timer = setTimeout(() => finish(Object.assign(fail('YouTube download timed out. Try a shorter video or upload the file.',422),{code:'yt_timeout'})), timeout);
    // Also bound unknown-size downloads; --max-filesize alone cannot cap those.
    if (dir) monitor = setInterval(async () => {
      try { let total=0; for (const name of await fsp.readdir(dir)) { const stat=await fsp.stat(path.join(dir,name)); if(stat.isFile())total+=stat.size; } if(total>MAX_BYTES*1.6)finish(workerError('file too large')); } catch { /* directory can disappear during cleanup */ }
    }, 300);
    child.stdout.on('data', data => { out += data; if(out.length>4*1024*1024)finish(fail('YouTube returned too much metadata.',422)); });
    child.stderr.on('data', data => { err=(err+data).slice(-12000); });
    child.on('error', () => finish(fail('The download worker could not start. Ask the administrator to check its installation.',503)));
    child.on('close', code => code===0 ? finish(null,out) : finish(workerError(err)));
  });
}
function commonArgs() {
  return ['--ignore-config','--no-playlist','--no-cache-dir','--no-progress','--socket-timeout','12','--retries','1','--fragment-retries','1','--extractor-retries','1','--js-runtimes',`node:${process.execPath}`,'--no-remote-components'];
}
async function downloadYouTube(value, dir, { signal, onMetadata = async()=>{}, execute = command } = {}) {
  const url = youtubeURL(value);
  if (execute === command && !available()) throw fail('The YouTube download worker is not installed. Upload the file instead.',503);
  const raw = await execute([...commonArgs(),'--dump-single-json','--skip-download','--',url], {dir,timeout:30000,signal});
  let meta;
  try { meta = JSON.parse(raw); } catch { throw fail('YouTube returned invalid metadata. Try uploading the file.',422); }
  validateMetadata(meta);
  const expectedID = new URL(url).searchParams.get('v');
  if (meta.id !== expectedID) throw fail('YouTube returned a different video. Please check the link.',422);
  await onMetadata(meta);
  const ffmpeg = process.env.FFMPEG_PATH || require.resolve('@ffmpeg-installer/linux-x64/ffmpeg');
  await execute([...commonArgs(),'--max-filesize',String(MAX_BYTES),'--format','bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[height<=480]', '--merge-output-format','mp4','--ffmpeg-location',ffmpeg,'--output',path.join(dir,'youtube.%(ext)s'),'--',url], {dir,timeout:90000,signal});
  const names = (await fsp.readdir(dir)).filter(n => /^youtube\.(mp4|webm|mkv)$/.test(n));
  if (names.length !== 1) throw workerError('download output missing');
  const file = path.join(dir,names[0]), stat = await fsp.stat(file);
  if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES) throw workerError('file too large');
  return { file, metadata:meta, bytes:stat.size, url };
}
module.exports = { VERSION, SHA256, DEFAULT_BINARY, available, smokeResult, youtubeURL, workerError, validateMetadata, commonArgs, command, downloadYouTube };
