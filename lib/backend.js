const {createClient} = require('@supabase/supabase-js');
const crypto = require('node:crypto');
const DEFAULTS = {style:'lime',crop:'center',clips:3,maxLen:30,captions:false,textCase:'upper',reduceMotion:false};
const MAX_BYTES = 50 * 1024 * 1024;
function fail(message,status=400) { return Object.assign(new Error(message),{status}); }
function client(token) {
 if(!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw fail('Supabase is not configured.',503);
 return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:token?{headers:{Authorization:`Bearer ${token}`}}:{}});
}
function checked(result) { if(result.error) throw fail(result.error.message,400); return result.data; }
function cookies(req) {return Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split(/=(.*)/s)).filter(p=>p.length>1));}
function setSession(req,res,session) {
 const secure = process.env.VERCEL || req.secure || req.headers['x-forwarded-proto']==='https';
 const opts=`; Path=/; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
 res.setHeader('Set-Cookie', [`cz_access=${session?.access_token||''}; Max-Age=${session?session.expires_in||3600:0}${opts}`,`cz_refresh=${session?.refresh_token||''}; Max-Age=${session?2592000:0}${opts}`]);
}
async function session(req,res) {
 const c=cookies(req); let token=c.cz_access; let sb=client(token); let u=token?await sb.auth.getUser(token):null;
 if(!u?.data?.user && c.cz_refresh) {
  const r=await client().auth.refreshSession({refresh_token:c.cz_refresh});
  if(r.data?.session) {setSession(req,res,r.data.session); token=r.data.session.access_token;sb=client(token);u={data:{user:r.data.user}};}
 }
 if(!u?.data?.user) throw fail('Sign in to continue.',401);
 return {sb,user:u.data.user,token};
}
async function profile(sb,user) {
 let p=checked(await sb.from('profiles').select('*').eq('id',user.id).maybeSingle());
 if(!p) p=checked(await sb.from('profiles').upsert({id:user.id,name:user.user_metadata?.name||user.email.split('@')[0]},{onConflict:'id'}).select().single());
 const admin=checked(await sb.rpc('is_clippfy_admin'));
 return {id:user.id,email:user.email,name:p.name,isAdmin:!!admin,settings:{...DEFAULTS,...p.settings}};
}
function options(body) {
 const clips=Number(body.clips), maxLen=Number(body.maxLen);
 if(!Number.isInteger(clips)||clips<1||clips>10||!Number.isFinite(maxLen)||maxLen<5||maxLen>60) throw fail('Choose 1–10 clips, each 5–60 seconds long.');
 return {clips,maxLen,style:['lime','yellow','fire','karaoke','single','classic'].includes(body.style)?body.style:'lime',crop:'center',captions:body.captions===true||body.captions==='true',textCase:body.textCase==='lower'?'lower':'upper'};
}
async function getJob(sb,user,id) {
 if(!/^[a-f0-9-]{36}$/i.test(id)) throw fail('Project not found.',404);
 const r=checked(await sb.from('jobs').select('*').eq('id',id).eq('user_id',user.id).maybeSingle());
 if(!r) throw fail('Project not found.',404);
 return r;
}
async function displayJob(sb,r) {
 const j={...r.payload,id:r.id,createdAt:new Date(r.created_at).getTime()};
 j.clips=await Promise.all((j.clips||[]).map(async(c)=>({...c,jobId:r.id,url:`/api/media/${r.id}/${c.index}/video`,thumbUrl:`/api/media/${r.id}/${c.index}/thumb`})));
 return j;
}
async function removeJob(sb,user,r) {
 if(['running','queued'].includes(r.payload.status)) throw fail('Cancel the project before deleting it.',409);
 const files=checked(await sb.storage.from('videos').list(`${user.id}/${r.id}`,{limit:100}));
 if(files.length) checked(await sb.storage.from('videos').remove(files.map(f=>`${user.id}/${r.id}/${f.name}`)));
 checked(await sb.from('jobs').delete().eq('id',r.id).eq('user_id',user.id));
}
function safeFilename(name) { return String(name||'video.mp4').replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,100); }
module.exports={DEFAULTS,MAX_BYTES,fail,client,checked,setSession,session,profile,options,getJob,displayJob,removeJob,safeFilename,crypto};
