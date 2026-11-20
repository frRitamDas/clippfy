const fs=require('node:fs/promises');
const {fail}=require('./backend');
function config(env=process.env) {
 const provider=env.TRANSCRIPTION_PROVIDER|| (env.GROQ_API_KEY?'groq':'none');
 if(provider==='none')return null;
 if(provider==='groq')return {provider,key:env.GROQ_API_KEY,url:'https://api.groq.com/openai/v1/audio/transcriptions',model:'whisper-large-v3-turbo'};
 if(provider==='openai')return {provider,key:env.OPENAI_API_KEY,url:'https://api.openai.com/v1/audio/transcriptions',model:'whisper-1'};
 throw fail('Unsupported transcription provider. Choose groq, openai or none.',503);
}
function configured(){try{return !!config()?.key;}catch{return false;}}
async function transcribe(file,signal,fetcher=fetch) {
 const c=config();
 if(!c?.key)throw fail('Captions are not configured. Add a Groq free-tier key or turn captions off.',503);
 const fd=new FormData();fd.append('file',new Blob([await fs.readFile(file)],{type:'audio/mpeg'}),'audio.mp3');fd.append('model',c.model);fd.append('response_format','verbose_json');fd.append('timestamp_granularities[]','word');
 let r;
 try {r=await fetcher(c.url,{method:'POST',headers:{Authorization:`Bearer ${c.key}`},body:fd,redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)});}
 catch{throw fail('Transcription could not connect or timed out. Try again or turn captions off.',503);}
 if(!r.ok)throw fail(r.status===429?'Transcription quota reached. Wait for your provider quota to reset or turn captions off.':r.status===401||r.status===403?'Transcription key rejected. Check the server-side provider key.':'Transcription provider failed. Try again or turn captions off.',503);
 const data=await r.json();
 if(!Array.isArray(data.words))throw fail('Transcription provider did not return word timestamps. Turn captions off or check the configured model.',503);
 return {words:data.words.filter(w=>typeof w.word==='string'&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start>=0&&w.end>=w.start&&w.end<=301).slice(0,10000)};
}
module.exports={config,configured,transcribe};
