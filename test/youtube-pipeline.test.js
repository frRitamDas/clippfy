const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const P=require('../lib/processor');
const D=require('../lib/downloader');
function memoryDB(payload){
 let row={payload:structuredClone(payload)};const files=new Map();
 const sb={rpc:async()=>({data:true}),from(){
  let patch,filters=[];const query={select(){return query;},update(p){patch=p;return query;},eq(k,v){filters.push([k,v]);return query;},
   async maybeSingle(){if(filters.some(([k,v])=>k==='payload->>status'&&row.payload.status!==v))return {data:null};if(patch)row={...row,...structuredClone(patch)};return {data:structuredClone(row)};},
   async single(){return query.maybeSingle();},then(resolve,reject){return query.maybeSingle().then(resolve,reject);}
  };return query;
 },storage:{from(){return {upload:async(key,data)=>{files.set(key,data);return {data:{}};},download:async key=>({data:new Blob([files.get(key)])})};}}};
 return {sb,files,row:()=>row,set(patch){row.payload={...row.payload,...patch};}};
}
const initial={status:'queued',stage:'download',stages:{},sourceType:'youtube',sourceURL:'https://www.youtube.com/watch?v=BaW_jenozKc',sourcePath:'user/project/source',sourceBytes:50*1024*1024,clips:[],options:{clips:1,maxLen:5,captions:false}};
test('YouTube job downloads, persists privately, renders an MP4 and is claimed only once',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'yt-pipeline-')),original=D.downloadYouTube;let calls=0;
 try{
  const fixture=path.join(dir,'fixture.mp4');await P.run(['-f','lavfi','-i','color=c=green:s=320x240:d=1','-c:v','libx264',fixture]);
  const db=memoryDB(initial);
  D.downloadYouTube=async(url,workDir,{onMetadata})=>{calls++;assert.equal(url,initial.sourceURL);await onMetadata({title:'Real fixture',duration:1});await new Promise(r=>setTimeout(r,10));return{file:fixture,bytes:(await fs.stat(fixture)).size,metadata:{duration:1}};};
  await Promise.all([P.processJob(db.sb,{id:'user'},'project'),P.processJob(db.sb,{id:'user'},'project')]);
  assert.equal(calls,1);assert.equal(db.row().payload.status,'done',db.row().payload.error);assert.equal(db.row().payload.title,'Real fixture');assert.equal(db.row().payload.clips.length,1);assert(db.files.get(initial.sourcePath).length>1000);assert(db.files.get('user/project/0.mp4').length>1000);assert(db.row().payload.sourceBytes<50*1024*1024);
 }finally{D.downloadYouTube=original;await fs.rm(dir,{recursive:true,force:true});}
});
test('a blocked YouTube job becomes failed with a safe actionable error, not a completed empty project',async()=>{
 const original=D.downloadYouTube,db=memoryDB(initial);
 try{D.downloadYouTube=async()=>{throw D.workerError('Sign in to confirm you are not a bot');};await P.processJob(db.sb,{id:'user'},'project');assert.equal(db.row().payload.status,'failed');assert.equal(db.row().payload.errorCode,'yt_blocked');assert.match(db.row().payload.error,/Upload/);assert.equal(db.row().payload.clips.length,0);}finally{D.downloadYouTube=original;}
});
test('cancellation during metadata cannot be overwritten by a late worker update',async()=>{
 const original=D.downloadYouTube,db=memoryDB(initial);
 try{D.downloadYouTube=async(url,dir,{onMetadata})=>{db.set({status:'failed',error:'Cancelled'});await onMetadata({title:'Too late',duration:1});throw new Error('must not get here');};await P.processJob(db.sb,{id:'user'},'project');assert.equal(db.row().payload.status,'failed');assert.equal(db.row().payload.error,'Cancelled');assert.equal(db.row().payload.clips.length,0);}finally{D.downloadYouTube=original;}
});
