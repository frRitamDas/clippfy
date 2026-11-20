const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const D=require('../lib/downloader');
const id='BaW_jenozKc',canonical=`https://www.youtube.com/watch?v=${id}`;
test('YouTube input is canonicalized, with no arbitrary hosts, credentials, ports or playlists',()=>{
 for(const url of [`https://youtu.be/${id}?t=5`,`https://www.youtube.com/watch?v=${id}&list=ignored`,`https://m.youtube.com/shorts/${id}`,`http://youtube.com/embed/${id}`])assert.equal(D.youtubeURL(url),canonical);
 for(const url of ['file:///etc/passwd','http://127.0.0.1/watch?v='+id,'https://youtube.com.evil.test/watch?v='+id,'https://evil.youtube.com/watch?v='+id,'https://youtube.com@127.0.0.1/watch?v='+id,'https://user:pass@youtube.com/watch?v='+id,'https://youtube.com:444/watch?v='+id,'https://youtube.com/playlist?list=test','https://youtube.com/watch?v=--exec+bad','https://youtu.be/'+id+'/extra'])assert.throws(()=>D.youtubeURL(url),url);
});
test('metadata rejects live, private, age-restricted, non-video sources but accepts recordings longer than five minutes',()=>{
 const base={id,duration:13,live_status:'not_live'};assert.equal(D.validateMetadata(base),base);assert.equal(D.validateMetadata({...base,duration:7200}).duration,7200);
 for(const patch of [{duration:undefined},{duration:Infinity},{_type:'playlist'},{is_live:true},{is_upcoming:true},{live_status:'post_live'},{age_limit:18},{availability:'private'}])assert.throws(()=>D.validateMetadata({...base,...patch}));
});
test('download worker checks metadata before downloading and only returns a bounded video file',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'yt-worker-test-'));const calls=[];let title;
 try{const result=await D.downloadYouTube(canonical,dir,{execute:async(args,opts)=>{calls.push(args);assert.equal(opts.dir,dir);assert.equal(args.at(-1),canonical);assert.equal(args.at(-2),'--');assert(args.includes('--ignore-config'));assert(args.includes('--no-playlist'));if(args.includes('--dump-single-json'))return JSON.stringify({id,title:'Test video',duration:13});await fs.writeFile(path.join(dir,'youtube.mp4'),'video');return '';},onMetadata:async m=>{title=m.title;}});assert.equal(title,'Test video');assert.equal(result.bytes,5);assert.equal(calls.length,2);assert(calls[1].includes('--max-filesize'));assert(calls[1].includes('--ffmpeg-location'));}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('invalid-duration metadata and mismatched IDs never reach the download step',async()=>{
 let calls=0;
 for(const meta of [{id,duration:-1},{id:'xxxxxxxxxxx',duration:10}]){calls=0;await assert.rejects(D.downloadYouTube(canonical,'/tmp',{execute:async()=>{calls++;return JSON.stringify(meta);}}));assert.equal(calls,1);}
});
test('missing output and oversized output cannot become completed downloads',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'yt-worker-size-'));
 try{
  await assert.rejects(D.downloadYouTube(canonical,dir,{execute:async(args)=>args.includes('--dump-single-json')?JSON.stringify({id,duration:10}):''}),/download failed/i);
  await assert.rejects(D.downloadYouTube(canonical,dir,{execute:async(args)=>{if(args.includes('--dump-single-json'))return JSON.stringify({id,duration:10});const f=await fs.open(path.join(dir,'youtube.mp4'),'w');await f.truncate(51*1024*1024);await f.close();return ''}}),/50 MB/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('worker errors are actionable and do not leak raw extractor output',()=>{const err=D.workerError('403 Sign in to confirm you are not a bot. private diagnostic token=secret');assert.equal(err.code,'yt_blocked');assert(!err.message.includes('secret'));assert.match(err.message,/Upload/);});
function fakeChild(){const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{child.killed=true;};return child;}
test('child process receives separate arguments and cannot invoke a shell',async()=>{const child=fakeChild();let options;const task=D.command(['--',canonical],{spawnProcess:(bin,args,opts)=>{options=opts;assert.deepEqual(args,['--',canonical]);setImmediate(()=>{child.stdout.emit('data','ok');child.emit('close',0)});return child;}});assert.equal(await task,'ok');assert.equal(options.shell,false);assert.equal(options.env.OPENAI_API_KEY,undefined);});
test('timeouts and cancellation kill the downloader and reject the job',async()=>{
 const timed=fakeChild();await assert.rejects(D.command([],{timeout:10,spawnProcess:()=>timed}),/timed out/);assert.equal(timed.killed,true);
 const child=fakeChild(),controller=new AbortController();const task=D.command([],{signal:controller.signal,spawnProcess:()=>child});controller.abort(new Error('User cancelled'));await assert.rejects(task,/cancelled/);assert.equal(child.killed,true);
});
