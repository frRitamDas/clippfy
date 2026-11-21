const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');const G=require('../lib/script-generator');
const brief=()=>({topic:'Teach beginner creators to record better phone audio.',audience:'Beginner creators',tone:'educational',seconds:30,language:'English'});
const draft=()=>({hooks:['Hook one','Hook two','Hook three'],titles:['Title one','Title two','Title three'],script:'A useful narration to record.',shots:['Show the phone','Move closer','Compare two recordings'],description:'Improve your recordings.',hashtags:['#creators','#audio','#video']});
test('script brief validates bounded inputs, enums and language without trusting arbitrary model/URL',()=>{
 assert.equal(G.configured({OPENAI_API_KEY:'paid'}),false);assert.equal(G.configured({GROQ_API_KEY:'key',SCRIPT_GENERATION_ENABLED:'false'}),false);
 assert.equal(G.input({...brief(),model:'expensive',url:'https://evil.test'}).model,undefined);
 for(const b of [{topic:'short'},{topic:'a'.repeat(2501)},{audience:''},{language:[]},{seconds:'30'},{seconds:500},{tone:'bad'}])assert.throws(()=>G.input({...brief(),...b}));
});
test('script generation uses only fixed Groq open-weight model, token budget and JSON; no paid fallback',async()=>{
 let calls=0;const data=await G.generate(brief(),async(url,init)=>{calls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer test');const body=JSON.parse(init.body);assert.equal(body.model,'openai/gpt-oss-20b');assert.equal(body.max_completion_tokens,2500);assert.equal(body.response_format.type,'json_object');assert.equal(JSON.parse(body.messages[1].content).topic,brief().topic);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(draft())}}]})};},{GROQ_API_KEY:'test'});assert.equal(calls,1);assert.equal(data.draft.hooks.length,3);assert.equal(data.provider,'groq');
 await assert.rejects(G.generate(brief(),async()=>{throw Error('must not run');},{OPENAI_API_KEY:'paid'}),/not configured/);
});
test('script generation rejects quota, credentials, provider failures and malformed model output',async()=>{
 for(const [status,pattern] of [[429,/quota reached/],[401,/key was rejected/],[500,/unavailable/]])await assert.rejects(G.generate(brief(),async()=>({ok:false,status}),{GROQ_API_KEY:'test'}),pattern);
 await assert.rejects(G.generate(brief(),async()=>{throw Error('network')},{GROQ_API_KEY:'test'}),/timed out/);
 await assert.rejects(G.generate(brief(),async()=>({ok:true,json:async()=>({choices:[]})}),{GROQ_API_KEY:'test'}),/unreadable/);
 assert.throws(()=>G.output({...draft(),hooks:['only one']}),/incomplete/);assert.throws(()=>G.output({...draft(),script:'a'.repeat(5001)}),/incomplete/);
});
test('script throttle prevents parallel work and allows three attempts per instance minute',()=>{
 const user='throttle-test',now=Date.now();let release=G.acquire(user,now);assert.throws(()=>G.acquire(user,now),/wait a minute/);release();release=G.acquire(user,now);release();release=G.acquire(user,now);release();assert.throws(()=>G.acquire(user,now),/wait a minute/);G.acquire(user,now+60001)();
});
test('script endpoints require authentication and return generated results without storing prompts',async()=>{
 const app=require('../api'),B=require('../lib/backend'),oldSession=B.session,oldGenerate=G.generate;let authenticated=false,calls=0;
 B.session=async()=>{if(!authenticated)throw B.fail('Sign in',401);return {user:{id:'script-api-test'},sb:{}};};G.generate=async body=>{calls++;return {draft:draft(),brief:body,provider:'groq',model:G.MODEL};};const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/api/scripts/generate`,send=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{assert.equal((await send(brief())).status,401);authenticated=true;assert.equal((await send({...brief(),seconds:999})).status,400);const response=await send(brief());assert.equal(response.status,200);assert.equal((await response.json()).draft.script,draft().script);assert.equal(calls,1);}finally{B.session=oldSession;G.generate=oldGenerate;await new Promise(r=>server.close(r));}
});
test('script UI safely renders generated text, updates spoken timing, preserves a draft on error and clears on logout',async()=>{
 const source=fs.readFileSync('app.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),dom=new JSDOM(source,{url:'https://clippfy.test/app#scripts',runScripts:'outside-only'}),w=dom.window;let fail=false,requests=[];
 w.eval('var state={user:{id:"creator"}};function toast(){}');w.api=async(path,options)=>{requests.push({path,options});if(fail)throw Error('quota reached');return {draft:{...draft(),script:'<script>alert(1)</script> A real draft'},brief:options.json,model:G.MODEL,provider:'groq'};};w.document.body.classList.remove('locked');
 try{w.eval(fs.readFileSync('assets/integration/script-studio.js','utf8'));const form=w.document.getElementById('scriptForm');form.elements.topic.value=brief().topic;await form.onsubmit({preventDefault(){}});assert.equal(requests[0].path,'/api/scripts/generate');assert.equal(requests[0].options.json.seconds,30);assert.equal(w.document.querySelector('#scriptResult script'),null);assert(w.document.getElementById('generatedScript').value.includes('<script>'));assert(w.document.getElementById('scriptReadTime').textContent.includes('seconds'));form.elements.topic.value='An entirely new idea for creators';fail=true;await form.onsubmit({preventDefault(){}});assert.equal(w.document.getElementById('scriptError').textContent,'quota reached');assert.equal(w.document.getElementById('scriptResult').hidden,false);assert.equal(w.document.getElementById('scriptGenerate').disabled,false);w.document.body.classList.add('locked');await new Promise(r=>setTimeout(r,0));assert.equal(w.document.getElementById('scriptResult').hidden,true);assert.equal(form.elements.topic.value,'');}finally{w.close();}
});
