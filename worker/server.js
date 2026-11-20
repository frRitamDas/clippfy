// Optional always-running container worker. No service-role key or saved user passwords.
const express=require('express');
const {client,getJob,fail,MAX_SOURCE_SECONDS}=require('../lib/backend');
const {available,VERSION}=require('../lib/downloader');
const {processJob}=require('../lib/processor');
function createWorker({makeClient=client,process=processJob,isAvailable=available,concurrency=2}={}) {
 const app=express();let active=0,closing=false;
 app.disable('x-powered-by');app.use(express.json({limit:'4kb'}));
 app.get('/health',(req,res)=>res.json({ok:!closing,downloadWorker:isAvailable()?VERSION:null,active,capacity:concurrency,maxSourceSeconds:Number.isFinite(MAX_SOURCE_SECONDS)?MAX_SOURCE_SECONDS:null}));
 app.post('/jobs',async(req,res)=>{
  try {
   if(closing||active>=concurrency)throw fail('Worker busy. Try again shortly.',503);
   if(!isAvailable())throw fail('Downloader not installed.',503);
   const match=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization||'');
   if(!match)throw fail('Authentication required.',401);
   // Verify the forwarded Supabase JWT, then enforce ownership with the same RLS.
   const sb=makeClient(match[1]);const auth=await sb.auth.getUser(match[1]);
   if(auth.error||!auth.data?.user)throw fail('Authentication required.',401);
   const user=auth.data.user;
   const row=await getJob(sb,user,String(req.body?.jobId||''));
   if(row.payload.status!=='queued')return res.status(202).json({accepted:true,status:row.payload.status});
   // Check again after async auth/DB reads; this counter is a capacity bound, not a queue.
   if(closing||active>=concurrency)throw fail('Worker busy. Try again shortly.',503);
   active++;
   Promise.resolve().then(()=>process(sb,user,row.id)).catch(error=>console.error('Worker task failed:',error.status?error.message:'internal failure')).finally(()=>active--);
   res.status(202).json({accepted:true});
  } catch(error) {res.status(error.status||500).json({error:error.status?error.message:'Worker request failed.'});}
 });
 app.use((error,req,res,next)=>res.status(error.status||500).json({error:'Invalid worker request.'}));
 return {app,drain(){closing=true;},active:()=>active};
}
if(require.main===module) {
 const worker=createWorker();
 const server=worker.app.listen(Number(global.process.env.PORT)||8080,'0.0.0.0',()=>console.log('Clippfy download worker ready'));
 global.process.on('SIGTERM',()=>{worker.drain();server.close();const timer=setInterval(()=>{if(!worker.active()){clearInterval(timer);global.process.exit(0);}},500);setTimeout(()=>global.process.exit(1),280000).unref();});
}
module.exports={createWorker};
