const express=require('express');
const B=require('../lib/backend');
const {processJob}=require('../lib/processor');
const app=express();
app.disable('x-powered-by');app.set('trust proxy',1);
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host;}catch{}if(origin!==req.headers.host)return res.status(403).json({error:'Cross-site request rejected.'});}next();});
app.use(express.json({limit:'100kb'}));
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
app.get('/api/health',(req,res)=>res.json({ok:true,configured:!!process.env.SUPABASE_URL,transcription:!!process.env.OPENAI_API_KEY,links:false,payments:false,maxBytes:B.MAX_BYTES,maxDuration:300}));
app.get('/api/offer',(req,res)=>res.json({open:false,now:Date.now(),endsAt:0}));
app.get('/api/auth/providers',(req,res)=>res.json({google:false}));
app.post('/api/auth/signup',wrap(async(req,res)=>{
 const {email,password,name}=req.body||{};if(typeof name!=='string'||!name.trim())throw B.fail('Enter your name.');if(typeof password!=='string'||password.length<8)throw B.fail('Use at least 8 password characters.');
 const sb=B.client();const data=B.checked(await sb.auth.signUp({email,password,options:{data:{name:name.trim().slice(0,100)},emailRedirectTo:'https://clippfyediting.vercel.app/app'}}));
 if(!data.session)return res.json({confirmationRequired:true});B.setSession(req,res,data.session);res.json(await B.profile(B.client(data.session.access_token),data.user));
}));
app.post('/api/auth/login',wrap(async(req,res)=>{const {email,password}=req.body||{};const data=B.checked(await B.client().auth.signInWithPassword({email,password}));B.setSession(req,res,data.session);res.json(await B.profile(B.client(data.session.access_token),data.user));}));
app.post('/api/auth/session',wrap(async(req,res)=>{const {access_token,refresh_token}=req.body||{};if(typeof access_token!=='string'||typeof refresh_token!=='string')throw B.fail('Invalid session.');const data=B.checked(await B.client().auth.setSession({access_token,refresh_token}));B.setSession(req,res,data.session);res.json(await B.profile(B.client(data.session.access_token),data.user));}));
app.post('/api/auth/recover',wrap(async(req,res)=>{B.checked(await B.client().auth.resetPasswordForEmail(req.body.email,{redirectTo:'https://clippfyediting.vercel.app/reset'}));res.json({ok:true});}));
app.post('/api/auth/logout',wrap(async(req,res)=>{try{const {token}=await B.session(req,res);await fetch(process.env.SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{apikey:process.env.SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`}});}catch{}B.setSession(req,res,null);res.json({ok:true});}));
app.use('/api', (req,res,next)=>{B.session(req,res).then(s=>{Object.assign(req,s);next();}).catch(next);});
app.get('/api/auth/me',wrap(async(req,res)=>res.json(await B.profile(req.sb,req.user))));
app.post('/api/auth/password',wrap(async(req,res)=>{if(typeof req.body.password!=='string'||req.body.password.length<8)throw B.fail('Use at least 8 characters.');const r=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{method:'PUT',headers:{'Content-Type':'application/json',apikey:process.env.SUPABASE_ANON_KEY,Authorization:`Bearer ${req.token}`},body:JSON.stringify({password:req.body.password})});if(!r.ok)throw B.fail('Password update failed. Request a new recovery link.');res.json({ok:true});}));
app.patch('/api/account',wrap(async(req,res)=>{
 const p=await B.profile(req.sb,req.user);const patch={};
 if(req.body.name!==undefined){if(typeof req.body.name!=='string'||!req.body.name.trim())throw B.fail('Name is required.');patch.name=req.body.name.trim().slice(0,100);}
 if(req.body.email&&req.body.email!==req.user.email)throw B.fail('Email changes require verified identity. Please contact the administrator.');
 if(req.body.settings){patch.settings={...p.settings};for(const key of Object.keys(B.DEFAULTS)){const v=req.body.settings[key];if(v!==undefined&&typeof v===typeof B.DEFAULTS[key])patch.settings[key]=v;}}
 B.checked(await req.sb.from('profiles').update(patch).eq('id',req.user.id));res.json(await B.profile(req.sb,req.user));
}));
const plans={starter:{name:'Starter',price:19,yearPrice:190,clips:30,storage:1,uploads:true,live:false,maxRes:'1080p'},clipper:{name:'Clipper',price:39,yearPrice:390,clips:100,storage:5,uploads:true,live:false,maxRes:'1080p'},pro:{name:'Pro',price:79,yearPrice:790,clips:300,storage:10,uploads:true,live:false,maxRes:'1080p'},trial:{clips:10,storage:1}};
async function rows(req){return B.checked(await req.sb.from('jobs').select('*').eq('user_id',req.user.id).order('created_at',{ascending:false}).limit(100));}
app.get('/api/billing',wrap(async(req,res)=>{const data=await rows(req);const used=data.reduce((s,r)=>s+(r.payload.clips||[]).length,0);res.json({active:true,free:true,tier:'starter',plan:'starter',interval:'month',configured:false,canManage:false,dev:false,offerOpen:false,trialUsed:false,trial:{then:'starter',thenInterval:'month',days:3},plans,usage:{clipsUsed:used,clipsLeft:Math.max(0,30-used),clipsLimit:30,storageBytes:data.reduce((s,r)=>s+(r.payload.sourceBytes||0)+(r.payload.clips||[]).reduce((n,c)=>n+(c.bytes||0),0),0),storageLimit:0.5},limits:{uploads:true},status:'free'});}));
app.post('/api/billing/{*path}',(req,res)=>res.status(503).json({error:'Paid billing is not configured. The free upload workspace is available; no payment has been taken.'}));
app.get('/api/stats',wrap(async(req,res)=>{const data=await rows(req);res.json({projects:data.length,clips:data.reduce((s,r)=>s+r.payload.clips.length,0),sourceMinutes:Math.round(data.reduce((s,r)=>s+(r.payload.duration||0),0)/60),avgScore:0,storageBytes:data.reduce((s,r)=>s+(r.payload.sourceBytes||0),0)});}));
app.post('/api/uploads',wrap(async(req,res)=>{
 const data=await rows(req);if(data.some(r=>['queued','running'].includes(r.payload.status)))throw B.fail('Wait for your current project or cancel it first.',409);
 if(data.length>=30)throw B.fail('Workspace limit reached. Delete old projects first.',409);
 if(!Number.isFinite(req.body.size)||req.body.size<1||req.body.size>B.MAX_BYTES)throw B.fail('Choose a video up to 50 MB.');
 if(data.reduce((s,r)=>s+(r.payload.sourceBytes||0)+(r.payload.clips||[]).reduce((n,c)=>n+(c.bytes||0),0),0)+req.body.size>500*1024*1024)throw B.fail('Storage limit reached. Delete old projects first.');
 const id=B.crypto.randomUUID(),name=B.safeFilename(req.body.name),sourcePath=`${req.user.id}/${id}/source`;
 const result=B.checked(await req.sb.storage.from('videos').createSignedUploadUrl(sourcePath));
 res.json({id,path:sourcePath,uploadUrl:result.signedUrl,name});
}));
app.get('/api/jobs',wrap(async(req,res)=>res.json(await Promise.all((await rows(req)).map(r=>B.displayJob(req.sb,r))))));
app.post('/api/jobs',wrap(async(req,res)=>{
 if(req.body.url)throw B.fail('Link importing needs a separate download worker. Upload a video file instead.',503);
 const opts=B.options(req.body);if(opts.captions&&!process.env.OPENAI_API_KEY)throw B.fail('Automatic captions need an OpenAI API key configured by the administrator. Turn captions off to generate clips now.',503);
 const id=req.body.id;if(!/^[a-f0-9-]{36}$/i.test(id||''))throw B.fail('Upload a video first.');
 const all=await rows(req);if(all.some(r=>['running','queued'].includes(r.payload.status)))throw B.fail('A project is already running.',409);if(all.reduce((s,r)=>s+r.payload.clips.length,0)+opts.clips>30)throw B.fail('Free workspace limit is 30 clips. Delete old projects to free space.');
 const sourcePath=`${req.user.id}/${id}/source`;const files=B.checked(await req.sb.storage.from('videos').list(`${req.user.id}/${id}`,{limit:10}));const file=files.find(f=>f.name==='source');
 if(!file||file.metadata.size>B.MAX_BYTES)throw B.fail('Upload is missing or exceeds 50 MB.');
 const payload={title:B.safeFilename(req.body.name),status:'queued',progress:0,stage:'download',stages:{},options:opts,clips:[],sourcePath,sourceBytes:file.metadata.size,selection:'evenly_spaced'};
 const r=B.checked(await req.sb.from('jobs').insert({id,user_id:req.user.id,payload}).select().single());
 const task=processJob(req.sb,req.user,id);if(process.env.VERCEL){require('@vercel/functions').waitUntil(task);}else task.catch(console.error);
 res.status(202).json(await B.displayJob(req.sb,r));
}));
app.get('/api/jobs/:id',wrap(async(req,res)=>{let r=await B.getJob(req.sb,req.user,req.params.id);if(['queued','running'].includes(r.payload.status)&&Date.now()-new Date(r.created_at).getTime()>360000){r.payload={...r.payload,status:'failed',error:'Processing exceeded the server time limit. Try a shorter video.'};B.checked(await req.sb.from('jobs').update({payload:r.payload}).eq('id',r.id));}res.json(await B.displayJob(req.sb,r));}));
app.post('/api/jobs/:id/cancel',wrap(async(req,res)=>{const r=await B.getJob(req.sb,req.user,req.params.id);if(['queued','running'].includes(r.payload.status))B.checked(await req.sb.from('jobs').update({payload:{...r.payload,status:'failed',error:'Cancelled'}}).eq('id',r.id));res.json({ok:true});}));
app.delete('/api/jobs/:id',wrap(async(req,res)=>{await B.removeJob(req.sb,req.user,await B.getJob(req.sb,req.user,req.params.id));res.json({ok:true});}));
app.delete('/api/jobs',wrap(async(req,res)=>{const data=(await rows(req)).filter(r=>!['queued','running'].includes(r.payload.status));for(const r of data)await B.removeJob(req.sb,req.user,r);res.json({removed:data.length});}));
app.post('/api/jobs/:id/clips/:index',wrap(async(req,res)=>{const row=await B.getJob(req.sb,req.user,req.params.id);if(row.payload.status!=='done')throw B.fail('Wait for processing to finish.',409);res.json(await require('../lib/processor').editClip(req.sb,req.user,row,Number(req.params.index),req.body));}));
app.get('/api/media/:id/:index/:kind',wrap(async(req,res)=>{const r=await B.getJob(req.sb,req.user,req.params.id);const clip=r.payload.clips.find(c=>String(c.index)===req.params.index);if(!clip)throw B.fail('Clip not found.',404);const key=req.params.kind==='thumb'?clip.thumbPath:clip.videoPath;const data=B.checked(await req.sb.storage.from('videos').createSignedUrl(key,3600,req.query.download?{download:`clippfy-${clip.index+1}.mp4`}:{}));res.redirect(302,data.signedUrl);}));
app.get('/api/admin',wrap(async(req,res)=>{if(!B.checked(await req.sb.rpc('is_clippfy_admin')))throw B.fail('Administrator access required.',403);res.json({profiles:B.checked(await req.sb.from('profiles').select('id,name,created_at').limit(100)),jobs:B.checked(await req.sb.from('jobs').select('*').order('created_at',{ascending:false}).limit(100)).map(r=>({id:r.id,userId:r.user_id,title:r.payload.title,status:r.payload.status,error:r.payload.error,createdAt:r.created_at})),configuration:{transcription:!!process.env.OPENAI_API_KEY,payments:false,linkImport:false}});}));
app.use('/api',(req,res)=>res.status(404).json({error:'API endpoint not found.'}));
app.use((err,req,res,next)=>{if(res.headersSent)return next(err);console.error(err.status?err.message:err);res.status(err.status||500).json({error:err.status?err.message:'Something went wrong on the server. Please try again.'});});
module.exports=app;
