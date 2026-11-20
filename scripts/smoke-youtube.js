// A real public downloader test fixture, run in Vercel's build environment.
// Failure is reported rather than breaking the upload fallback or pretending import works.
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {downloadYouTube}=require('../lib/downloader');
const {run}=require('../lib/processor');
(async()=>{
 let dir;const result={testedAt:new Date().toISOString(),success:false};
 try {
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'clippfy-youtube-smoke-'));
  const source=await downloadYouTube('https://www.youtube.com/watch?v=BaW_jenozKc',dir);
  const output=path.join(dir,'sample.mp4');
  await run(['-i',source.file,'-t','1','-vf','scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280','-c:v','libx264','-preset','ultrafast','-threads','2','-c:a','aac',output],15000);
  if((await fs.stat(output)).size<1000)throw new Error('Empty render');
  result.success=true;console.log('YOUTUBE LIVE SMOKE TEST PASSED: real download and vertical MP4 rendering.');
 }catch(error){result.errorCode=error.code||'youtube_smoke_failed';result.message=error.status?error.message:'Live YouTube smoke test could not complete.';console.warn('YOUTUBE LIVE SMOKE TEST FAILED: '+result.message);}
 finally{if(dir)await fs.rm(dir,{recursive:true,force:true});await fs.mkdir('vendor',{recursive:true});await fs.writeFile('vendor/youtube-smoke.json',JSON.stringify(result));}
})().catch(error=>{console.error(error.message);process.exit(1);});
