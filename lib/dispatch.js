const {fail}=require('./backend');
// Optional container worker. With no URL configured, use the bounded Vercel worker.
function workerURL() {
  if(!process.env.DOWNLOAD_WORKER_URL)return null;
  const url=new URL(process.env.DOWNLOAD_WORKER_URL);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw fail('DOWNLOAD_WORKER_URL must be a trusted HTTPS worker base URL without credentials or query parameters.',503);
  return new URL('jobs',url.href.replace(/\/?$/,'/')).href;
}
async function dispatchRemote(id,token,fetcher=fetch) {
 const url=workerURL();
 if(!url)return false;
 let response;
 try{response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({jobId:id}),signal:AbortSignal.timeout(10000),redirect:'error'});}
 catch{throw fail('The configured download worker could not be reached. Ask the administrator to check its deployment.',503);}
 if(!response.ok)throw fail(response.status===429||response.status===503?'The download worker is busy or unavailable. Please try again shortly.':'The download worker rejected this project. Ask the administrator to check its Supabase configuration.',503);
 return true;
}
module.exports={workerURL,dispatchRemote};
