(async()=>{
 const $=id=>document.getElementById(id),q=new URLSearchParams(location.search),id=q.get('job'),index=Number(q.get('clip'));
 async function api(path,init){const r=await fetch(path,init);const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 async function load(){const j=await api('/api/jobs/'+encodeURIComponent(id));const c=j.clips.find(c=>c.index===index);if(!c)throw Error('Clip not found.');$('video').src=c.url+'?v='+Date.now();$('end').value=c.duration.toFixed(2);$('start').value=0;$('end').max=c.duration;$('download').href=c.url+'?download=1';$('editor').hidden=false;$('status').textContent=j.title+' · Clip '+(index+1);}
 try{await load();}catch(e){$('status').textContent=e.message+' Sign in from the workspace if needed.';}
 $('start').oninput=()=>{$('video').currentTime=Number($('start').value);};
 $('video').ontimeupdate=()=>{if($('video').currentTime>Number($('end').value))$('video').pause();};
 $('editForm').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;$('status').textContent='Rendering changes…';try{await api(`/api/jobs/${encodeURIComponent(id)}/clips/${index}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:Number($('start').value),end:Number($('end').value),text:$('text').value,style:$('style').value})});$('text').value='';await load();$('status').textContent='Saved. Your edited clip is ready to download.';}catch(e){$('status').textContent=e.message;}finally{$('save').disabled=false;}};
})();
