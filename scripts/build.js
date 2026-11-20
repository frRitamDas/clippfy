// Install server-only dependencies before building static output.
if(process.env.SKIP_DOWNLOADER_INSTALL==='1'&&!process.env.VERCEL)console.log('Skipping downloader installation for local static-build test only.');
else require('node:child_process').execFileSync(process.execPath,['scripts/install-downloader.js'],{stdio:'inherit'});
if(process.env.VERCEL)require('node:child_process').execFileSync(process.execPath,['scripts/smoke-youtube.js'],{stdio:'inherit',timeout:155000});
const fs=require('node:fs');
fs.chmodSync(require.resolve('@ffmpeg-installer/linux-x64/ffmpeg'),0o755);
fs.rmSync('public',{recursive:true,force:true});fs.mkdirSync('public');
for(const f of fs.readdirSync('.').filter(f=>f.endsWith('.html')))fs.copyFileSync(f,'public/'+f);
fs.cpSync('assets','public/assets',{recursive:true});fs.cpSync('fonts','public/fonts',{recursive:true});
fs.writeFileSync('public/manifest.json',JSON.stringify({name:'Clippfy',short_name:'Clippfy',start_url:'/app',display:'standalone',background_color:'#101010',theme_color:'#d1fe17'}));
