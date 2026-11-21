const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
const P=require('../assets/integration/publishing');
const details=()=>({title:'A useful tip',caption:'Save this idea',hashtags:'#editing',cta:'Follow for more',notes:'Review before posting',status:'draft',platform:'YouTube Shorts',scheduledAt:null});
test('publishing input has bounded fields, explicit workflow and valid planned dates',()=>{
 assert.equal(P.validate(details()).title,'A useful tip');
 for(const patch of [{title:''},{title:'a'.repeat(121)},{caption:{}},{status:'viral'},{platform:'unknown'},{status:'scheduled'},{scheduledAt:'not a date'},{notes:'a'.repeat(2001)}])assert.throws(()=>P.validate({...details(),...patch}));
 const p=P.validate({...details(),status:'scheduled',scheduledAt:'2026-12-01T10:00:00+05:30',isAdmin:true});assert.equal(p.scheduledAt,'2026-12-01T04:30:00.000Z');assert.equal(p.isAdmin,undefined);
});
test('exports contain actual metadata, safely quote spreadsheets and escape calendar content',()=>{
 const clip={jobId:'project',index:2,duration:15,transcript:'Actual source words',publishing:{...details(),title:'=HYPERLINK("bad")',scheduledAt:'2026-12-01T10:00:00Z'}};
 const csv=P.csv([{clip,project:'=formula'}]);assert(csv.includes("\"'=formula\""));assert(csv.includes('""bad""'));assert(P.brief(clip).includes('Actual source words'));
 const ics=P.calendar({...clip,publishing:{...clip.publishing,title:'Hello\nEND:VEVENT, café '+ '語'.repeat(80)}});assert(ics.includes('DTSTART:20261201T100000Z'));assert(ics.includes('DTEND:20261201T101500Z'));assert(ics.includes('Hello\\nEND:VEVENT\\, café'));assert.equal(ics.split('\r\n').filter(l=>l==='END:VEVENT').length,1);for(const l of ics.split('\r\n'))assert(Buffer.byteLength(l)<=75);
 assert.equal(P.starter({transcript:''},'story'),'');assert(P.starter(clip,'takeaway').includes('Actual source words'));
});
test('publishing API persists authenticated owner metadata, rejects invalid/racing/foreign writes',async()=>{
 const B=require('../lib/backend'),app=require('../api'),original=B.session;
 const id='00000000-0000-4000-8000-000000000001';let row={id,user_id:'owner',payload:{status:'done',title:'Project',clips:[{index:0,title:'Clip 1',bytes:100}]}};let conflict=false,userId='owner';
 const sb={from(){let patch,filters=[];const q={select(){return q;},update(p){patch=p;return q;},eq(k,v){filters.push([k,v]);return q;},async maybeSingle(){if(conflict&&patch)return {data:null};if(filters.some(([k,v])=>k==='payload'?JSON.stringify(row.payload)!==v:row[k]!==v))return {data:null};if(patch)row={...row,...patch};return {data:structuredClone(row)};}};return q;}};
 B.session=async()=>({sb,user:{id:userId}});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/api/jobs/${id}/clips/0/publishing`;
 const save=body=>fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  let r=await save(details());assert.equal(r.status,200);assert.equal(row.payload.clips[0].title,'A useful tip');assert.equal(row.payload.clips[0].bytes,100);assert.equal(row.payload.clips[0].publishing.platform,'YouTube Shorts');
  r=await save({...details(),status:'invented'});assert.equal(r.status,400);
  conflict=true;r=await save(details());assert.equal(r.status,409);conflict=false;
  userId='intruder';r=await save(details());assert.equal(r.status,404);userId='owner';row.payload.status='running';r=await save(details());assert.equal(r.status,409);
 }finally{B.session=original;await new Promise(r=>server.close(r));}
});
test('publishing modal edits preview safely and saves through API; library exposes workflow filter and export',async()=>{
 const dom=new JSDOM('<button id="opener">Publishing kit <small>draft</small></button><div id="grid"></div>',{url:'https://clippfy.test/app',runScripts:'outside-only'}),w=dom.window;
 const clip={jobId:'project',index:0,title:'Clip 1',transcript:'A real takeaway',duration:12};let calls=[];
 w.eval(`var state={jobs:[],publishFilter:'all'};var esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));function toast(){};function renderLibrary(){};`);
 w.api=async(url,init)=>{calls.push({url,init});return {publishing:{...init.json,updatedAt:'2026-11-20T00:00:00Z'}};};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 try{
  w.eval(fs.readFileSync('assets/integration/publishing.js','utf8'));w.eval(fs.readFileSync('assets/integration/publishing-ui.js','utf8'));
  w.openPublishingKit(clip,w.document.getElementById('opener'));const dialog=w.document.querySelector('dialog'),form=dialog.querySelector('form');
  assert.equal(dialog.hasAttribute('open'),true);form.elements.title.value='<script>alert(1)</script>';form.dispatchEvent(new w.Event('input'));assert(dialog.querySelector('.publish-preview').textContent.includes('<script>'));assert.equal(dialog.querySelector('.publish-preview script'),null);
  dialog.querySelector('[data-starter="takeaway"]').click();assert(form.elements.caption.value.includes('A real takeaway'));
  form.elements.status.value='scheduled';await form.onsubmit({preventDefault(){}});assert.equal(calls.length,0);assert(dialog.querySelector('.publish-error').textContent.includes('planned date'));
  form.elements.status.value='ready';await form.onsubmit({preventDefault(){}});assert.equal(calls.length,1);assert.equal(calls[0].init.method,'PATCH');assert.equal(clip.publishing.status,'ready');assert.equal(w.document.querySelector('dialog'),null);assert.equal(w.document.querySelector('#opener small').textContent,'ready');
  w.publishingLibraryToolbar(w.document.getElementById('grid'));assert(w.document.getElementById('publishingToolbar').textContent.includes('Export content plan'));assert.equal(w.document.querySelectorAll('#publishingToolbar option').length,5);
 }finally{w.close();}
});
