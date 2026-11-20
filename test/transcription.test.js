const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const T=require('../lib/transcription');
test('paid OpenAI never selected implicitly; Groq is preferred and endpoints fixed',()=>{
 assert.equal(T.config({OPENAI_API_KEY:'paid'}),null);
 assert.equal(T.config({GROQ_API_KEY:'free',OPENAI_API_KEY:'paid'}).provider,'groq');
 assert.equal(T.config({TRANSCRIPTION_PROVIDER:'openai',OPENAI_API_KEY:'paid'}).model,'whisper-1');
 assert.equal(T.config({TRANSCRIPTION_PROVIDER:'none',GROQ_API_KEY:'free'}),null);
 assert.throws(()=>T.config({TRANSCRIPTION_PROVIDER:'invalid'}));
});
test('Groq requests word timestamps, filters invalid words, handles limits without paid fallback',async()=>{
 const old={...process.env};const dir=await fs.mkdtemp(path.join(os.tmpdir(),'clippfy-stt-'));const file=path.join(dir,'audio.mp3');await fs.writeFile(file,'test');
 process.env.TRANSCRIPTION_PROVIDER='groq';process.env.GROQ_API_KEY='test-key';
 try {
 const data=await T.transcribe(file,undefined,async(url,opts)=>{assert.equal(url,'https://api.groq.com/openai/v1/audio/transcriptions');assert.equal(opts.headers.Authorization,'Bearer test-key');assert.equal(opts.body.get('model'),'whisper-large-v3-turbo');assert.equal(opts.body.get('timestamp_granularities[]'),'word');assert.equal(opts.redirect,'error');return {ok:true,json:async()=>({words:[{word:'hello',start:0,end:1},{word:'bad',start:-1,end:5},{word:'bad',start:1,end:'2'}]})};});assert.equal(data.words.length,1);
 for(const [status,message] of [[429,/quota reached/],[401,/key rejected/],[500,/provider failed/]])await assert.rejects(T.transcribe(file,undefined,async()=>({ok:false,status})),message);
 await assert.rejects(T.transcribe(file,undefined,async()=>({ok:true,json:async()=>({text:'no timestamps'})})),/word timestamps/);
 }finally{for(const k of ['TRANSCRIPTION_PROVIDER','GROQ_API_KEY'])if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];await fs.rm(dir,{recursive:true,force:true});}
});
test('trial marquee stays visible without fake countdown or unavailable checkout claims',()=>{
 const {JSDOM}=require('jsdom');const source=require('node:fs').readFileSync(path.join(__dirname,'../assets/5_announce.js'),'utf8');const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://example.test'});try{dom.window.eval(source);assert(dom.window.document.documentElement.classList.contains('has-ann'));assert.match(dom.window.document.querySelector('.ann').textContent,/\$1 trial/);assert.match(dom.window.document.querySelector('.ann').textContent,/Coming soon/);assert(!dom.window.document.querySelector('[data-t="hms"]'));}finally{dom.window.close();}
});
