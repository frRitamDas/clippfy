const {test}=require('node:test');const assert=require('node:assert/strict');const {access,exceeds}=require('../lib/access');
function client(admin,grant){return {rpc:async()=>({data:admin}),from(){const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:grant})};return q;}};}
test('verified database admin gets uncapped workspace quotas, not client-supplied email',async()=>{const a=await access(client(true),{id:'verified'});assert.equal(a.admin,true);assert.equal(a.clipLimit,null);assert.equal(a.projectLimit,null);assert.equal(a.storageLimit,null);assert.equal(exceeds(a.clipLimit,1000000),false);const b=await access(client(false,null),{id:'ordinary',email:'ritam73592@gmail.com',user_metadata:{isAdmin:true}});assert.equal(b.admin,false);assert.equal(b.clipLimit,30);});
test('granted plans enforce quotas, expiry and revocation',async()=>{const user={id:'member'};assert.equal((await access(client(false,{plan:'pro',expires_at:null}),user)).clipLimit,300);assert.equal((await access(client(false,{plan:'clipper',expires_at:'2000-01-01'}),user)).clipLimit,30);assert.equal((await access(client(false,{plan:'free',expires_at:null}),user)).clipLimit,30);assert.equal(exceeds(30,31),true);assert.equal(exceeds(30,30),false);});
test('access lookup fails closed on database/RPC failure',async()=>{await assert.rejects(access({rpc:async()=>({error:{message:'permission denied'}})},{id:'member'}),/permission denied/);});
test('configured source duration accepts long recordings and optional explicit limit',()=>{const {execFileSync}=require('node:child_process');const script="const B=require('./lib/backend'),D=require('./lib/downloader'); console.log(B.MAX_SOURCE_SECONDS);D.validateMetadata({id:'test',duration:1000})";assert.match(execFileSync(process.execPath,['-e',script],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,MAX_SOURCE_SECONDS:'2000'},encoding:'utf8'}),/2000/);assert.throws(()=>execFileSync(process.execPath,['-e',script],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,MAX_SOURCE_SECONDS:'500'},stdio:'pipe'}));});

test('storage allowances follow advertised plan storage, not a per-file 50 MB cap',async()=>{
 const plans=require('../assets/plans.json');
 for(const plan of ['starter','clipper','pro']){
  const a=await access(client(false,{plan,expires_at:null}),{id:'member'});
  assert.equal(a.storageLimit,plans[plan].storage*1024**3);
  assert.equal(exceeds(a.storageLimit,200*1024**2),false);
 }
 assert.equal((await access(client(false,null),{id:'member'})).storageLimit,500*1024**2);
});
test('generated clips and edited replacements cannot grow past total plan storage',async()=>{
 const {ensureStorageCapacity}=require('../lib/access');
 const sb=client(false,null),original=sb.from;
 sb.from=table=>table==='clippfy_access'?original():{select(){return this;},eq(){return this;},range:async()=>({data:[{payload:{sourceBytes:400*1024**2,clips:[{bytes:50*1024**2}]}}]})};
 await ensureStorageCapacity(sb,{id:'member'},50*1024**2);
 await assert.rejects(ensureStorageCapacity(sb,{id:'member'},51*1024**2),/plan storage is full/);
 await ensureStorageCapacity(sb,{id:'member'},-10*1024**2);
});
