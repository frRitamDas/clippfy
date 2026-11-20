const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createWorker}=require('../worker/server');
const {workerURL,dispatchRemote}=require('../lib/dispatch');
test('remote dispatch is opt-in, HTTPS-only, authenticated and does not follow redirects',async()=>{
 const previous=process.env.DOWNLOAD_WORKER_URL;
 try {
  delete process.env.DOWNLOAD_WORKER_URL;assert.equal(await dispatchRemote('id','token'),false);
  for(const url of ['http://127.0.0.1:9000','https://user:pass@worker.test','https://worker.test/?token=secret']){process.env.DOWNLOAD_WORKER_URL=url;assert.throws(()=>workerURL());}
  process.env.DOWNLOAD_WORKER_URL='https://worker.test/base/';
  assert.equal(await dispatchRemote('job-id','user-jwt',async(url,init)=>{assert.equal(url,'https://worker.test/base/jobs');assert.equal(init.headers.Authorization,'Bearer user-jwt');assert.equal(init.redirect,'error');assert.deepEqual(JSON.parse(init.body),{jobId:'job-id'});return {ok:true};}),true);
  await assert.rejects(dispatchRemote('id','jwt',async()=>({ok:false,status:503})),/busy/);
  await assert.rejects(dispatchRemote('id','jwt',async()=>{throw Error('connection refused');}),/could not be reached/);
 }finally{if(previous===undefined)delete process.env.DOWNLOAD_WORKER_URL;else process.env.DOWNLOAD_WORKER_URL=previous;}
});
test('container verifies user JWT and job ownership, bounds capacity, and drains safely',async()=>{
 const id='00000000-0000-4000-8000-000000000001';let release,called=0;const filters=[];
 const worker=createWorker({isAvailable:()=>true,concurrency:1,makeClient:token=>({auth:{getUser:async()=>token==='valid.jwt'?{data:{user:{id:'owner'}}}:{error:Error('invalid')}},from(){const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},maybeSingle:async()=>({data:{id,user_id:'owner',payload:{status:'queued'}}})};return q;}}),process:async()=>{called++;await new Promise(r=>release=r);}});
 const server=worker.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const submit=token=>fetch(base+'/jobs',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({jobId:id})});
 try {
  assert.equal((await submit()).status,401);assert.equal((await submit('bad.jwt')).status,401);
  assert.equal((await submit('valid.jwt')).status,202);assert.equal(called,1);assert(filters.some(([k,v])=>k==='user_id'&&v==='owner'));assert(filters.some(([k,v])=>k==='id'&&v===id));
  assert.equal((await submit('valid.jwt')).status,503);release();await new Promise(r=>setTimeout(r,10));assert.equal(worker.active(),0);worker.drain();assert.equal((await submit('valid.jwt')).status,503);
 }finally{release?.();await new Promise(r=>server.close(r));}
});
