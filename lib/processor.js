const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {checked,fail,MAX_BYTES}=require('./backend');
const ffmpeg=process.env.FFMPEG_PATH||require.resolve('@ffmpeg-installer/linux-x64/ffmpeg');
function run(args,timeout=90000) {
 return new Promise((resolve,reject)=>{
  const p=spawn(ffmpeg,['-hide_banner','-nostdin','-y','-protocol_whitelist','file,pipe',...args],{stdio:['ignore','ignore','pipe']});let log='';
  const timer=setTimeout(()=>{p.kill('SIGKILL');reject(fail('Video processing timed out. Try a shorter video.',422));},timeout);
  p.stderr.on('data',d=>{log=(log+d).slice(-20000);});p.on('error',e=>{clearTimeout(timer);reject(e);});
  p.on('close',code=>{clearTimeout(timer);code===0?resolve(log):reject(fail('Unable to process this video. Upload a playable MP4, MOV or WebM.',422));});
 });
}
function durationFrom(log) {const m=log.match(/Duration: (\d+):(\d+):([\d.]+)/);return m?+m[1]*3600 + +m[2]*60 + +m[3]:0;}
function ranges(duration,count,len) {const n=Math.min(count,Math.max(1,Math.ceil(duration/len)));return Array.from({length:n},(_,i)=>{const start=i*duration/n;return {start,duration:Math.min(len,duration/n,duration-start)};});}
async function transcribe(file) {
 const fd=new FormData();fd.append('file',new Blob([await fs.readFile(file)],{type:'audio/mpeg'}),'audio.mp3');fd.append('model','whisper-1');fd.append('response_format','verbose_json');fd.append('timestamp_granularities[]','word');
 const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:fd,signal:AbortSignal.timeout(60000)});
 if(!r.ok) throw fail('Transcription failed. Check the OpenAI key and account balance, or turn captions off.',503);
 return r.json();
}
const assTime=s=>{s=Math.max(0,s);return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${(s%60).toFixed(2).padStart(5,'0')}`;};
function ass(words,start,dur,opts) {
 const colors={lime:'&H0017FED1',yellow:'&H0000E6FF',fire:'&H002E4AFF',karaoke:'&H00FFFFFF',single:'&H0017FED1',classic:'&H00FFFFFF'};
 let out=`[Script Info]\nScriptType: v4.00+\nPlayResX: 720\nPlayResY: 1280\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Anton,48,${colors[opts.style]||colors.lime},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,1,2,35,35,240,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
 const list=words.filter(w=>w.end>start&&w.start<start+dur);const size=opts.style==='single'?1:opts.style==='classic'?6:3;
 for(let i=0;i<list.length;i+=size){const g=list.slice(i,i+size);let text=g.map(w=>w.word).join(' ').replace(/[{}\\\r\n]/g,'');if(opts.textCase==='upper')text=text.toUpperCase();out+=`Dialogue: 0,${assTime(g[0].start-start)},${assTime(Math.min(dur,g.at(-1).end-start))},Default,,0,0,0,,${text}\n`;}
 return out;
}
async function processJob(sb,user,id) {
 let dir;
 const read=async()=>{const r=checked(await sb.from('jobs').select('payload').eq('id',id).eq('user_id',user.id).maybeSingle());if(!r||r.payload.status==='failed')throw fail('Cancelled',409);return r.payload;};
 const update=async patch=>{const current=await read();checked(await sb.from('jobs').update({payload:{...current,...patch}}).eq('id',id).eq('user_id',user.id));};
 try {
  let j=await read();dir=await fs.mkdtemp(path.join(os.tmpdir(),'clippfy-'));
  await update({status:'running',stage:'download',stageLabel:'Reading uploaded video',progress:5});
  const source=path.join(dir,'input');const blob=checked(await sb.storage.from('videos').download(j.sourcePath));
  if(blob.size>MAX_BYTES)throw fail('Maximum source size is 50 MB.');await fs.writeFile(source,Buffer.from(await blob.arrayBuffer()));
  const info=await run(['-i',source,'-t','0.1','-f','null','-']);const duration=durationFrom(info);
  if(!duration||duration>300)throw fail('Upload a video between 1 second and 5 minutes long.');
  await update({duration,stage:'transcribe',progress:15,stages:{download:100},stageLabel:j.options.captions?'Transcribing audio':'Captions disabled'});
  let words=[];
  if(j.options.captions){const audio=path.join(dir,'audio.mp3');await run(['-i',source,'-vn','-ar','16000','-ac','1','-b:a','48k',audio]);words=(await transcribe(audio)).words||[];}
  await update({stage:'analyze',progress:25,stages:{download:100,transcribe:100},stageLabel:'Selecting evenly spaced excerpts'});
  const parts=ranges(duration,j.options.clips,j.options.maxLen);
  await update({stage:'render',progress:30,stages:{download:100,transcribe:100,analyze:100}});
  for(let i=0;i<parts.length;i++) {
   await read();const part=parts[i],output=path.join(dir,`${i}.mp4`),thumb=path.join(dir,`${i}.jpg`);
   let filter='scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1';
   if(words.length){const subtitles=path.join(dir,'captions.ass');await fs.writeFile(subtitles,ass(words,part.start,part.duration,j.options));filter+=`,ass=${subtitles}:fontsdir=${path.resolve(__dirname,"../fonts")}`;}
   await run(['-ss',String(part.start),'-i',source,'-t',String(part.duration),'-vf',filter,'-c:v','libx264','-preset','ultrafast','-crf','25','-threads','2','-c:a','aac','-b:a','128k','-movflags','+faststart',output]);
   await run(['-i',output,'-frames:v','1','-vf','scale=180:320',thumb]);await read();
   const videoPath=`${user.id}/${id}/${i}.mp4`,thumbPath=`${user.id}/${id}/${i}.jpg`;
   const video=await fs.readFile(output);checked(await sb.storage.from('videos').upload(videoPath,video,{contentType:'video/mp4',upsert:true}));
   checked(await sb.storage.from('videos').upload(thumbPath,await fs.readFile(thumb),{contentType:'image/jpeg',upsert:true}));
   j=await read();const transcript=words.filter(w=>w.start>=part.start&&w.start<part.start+part.duration).map(w=>w.word).join(' ');
   const clip={index:i,rank:i+1,title:`Clip ${i+1}`,start:part.start,duration:part.duration,score:0,transcript,videoPath,thumbPath,bytes:video.length};
   await update({clips:[...j.clips,clip],progress:Math.round(30+(i+1)/parts.length*65)});
  }
  await update({status:'done',progress:100,stageLabel:'Ready — evenly spaced excerpts',stages:{download:100,transcribe:100,analyze:100,render:100}});
 } catch(e) {
  try {const r=await sb.from('jobs').select('payload').eq('id',id).single();if(r.data&&r.data.payload.status!=='failed')await sb.from('jobs').update({payload:{...r.data.payload,status:'failed',error:e.message||'Processing failed. Try a shorter video.'}}).eq('id',id);}catch{}
 } finally {if(dir)await fs.rm(dir,{recursive:true,force:true});}
}
module.exports={processJob,run,durationFrom,ranges,ass};

async function editClip(sb,user,row,index,body) {
 const clip=row.payload.clips.find(c=>c.index===index);if(!clip)throw fail('Clip not found.',404);
 const start=Number(body.start),end=Number(body.end),text=String(body.text||'').slice(0,500);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>clip.duration+0.05||end-start<0.5)throw fail('Choose valid trim points at least half a second apart.');
 let dir;
 try {
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'clippfy-edit-'));const source=path.join(dir,'in.mp4'),output=path.join(dir,'out.mp4'),thumb=path.join(dir,'out.jpg');
  const blob=checked(await sb.storage.from('videos').download(clip.videoPath));await fs.writeFile(source,Buffer.from(await blob.arrayBuffer()));
  const args=['-ss',String(start),'-i',source,'-t',String(end-start)];
  if(text){const sub=path.join(dir,'text.ass');await fs.writeFile(sub,ass([{word:text,start:0,end:end-start}],0,end-start,{style:body.style||'lime',textCase:'lower'}));args.push('-vf',`ass=${sub}:fontsdir=${path.resolve(__dirname,'../fonts')}`);}
  await run([...args,'-c:v','libx264','-preset','ultrafast','-crf','25','-threads','2','-c:a','aac','-movflags','+faststart',output]);await run(['-i',output,'-frames:v','1','-vf','scale=180:320',thumb]);
  const suffix=Date.now(),videoPath=`${user.id}/${row.id}/${index}-${suffix}.mp4`,thumbPath=`${user.id}/${row.id}/${index}-${suffix}.jpg`,video=await fs.readFile(output);
  checked(await sb.storage.from('videos').upload(videoPath,video,{contentType:'video/mp4'}));checked(await sb.storage.from('videos').upload(thumbPath,await fs.readFile(thumb),{contentType:'image/jpeg'}));
  const fresh=checked(await sb.from('jobs').select('payload').eq('id',row.id).eq('user_id',user.id).single());
  const clips=fresh.payload.clips.map(c=>c.index===index?{...c,videoPath,thumbPath,duration:end-start,transcript:text||c.transcript,bytes:video.length}:c);
  checked(await sb.from('jobs').update({payload:{...fresh.payload,clips}}).eq('id',row.id).eq('user_id',user.id));
  await sb.storage.from('videos').remove([clip.videoPath,clip.thumbPath]);return {ok:true};
 } finally {if(dir)await fs.rm(dir,{recursive:true,force:true});}
}
module.exports.editClip=editClip;
