/* Shared, dependency-free publishing helpers. Draft assistance, not AI or auto-posting. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ClippfyPublishing=factory();})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const statuses=['draft','ready','scheduled','published'];
 const platforms=['Instagram Reels','YouTube Shorts','TikTok','LinkedIn','Other'];
 function validate(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Enter valid publishing details.');
  const out={};
  for(const [key,max] of Object.entries({title:120,caption:5000,hashtags:1000,cta:300,notes:2000})){
   if(typeof body[key]!=='string'||body[key].length>max)throw new Error(`${key} must be text, up to ${max} characters.`);
   out[key]=body[key].trim();
  }
  if(!out.title)throw new Error('Give this clip a title.');
  if(!statuses.includes(body.status)||!platforms.includes(body.platform))throw new Error('Choose a valid status and platform.');
  out.status=body.status;out.platform=body.platform;out.scheduledAt=null;
  if(body.scheduledAt){if(typeof body.scheduledAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(body.scheduledAt)||!Number.isFinite(Date.parse(body.scheduledAt)))throw new Error('Choose a valid planned date.');out.scheduledAt=new Date(body.scheduledAt).toISOString();}
  if(out.status==='scheduled'&&!out.scheduledAt)throw new Error('Add a planned date for a scheduled post.');
  return out;
 }
 function defaults(clip){return {title:clip.title||'Untitled clip',caption:'',hashtags:'',cta:'',notes:'',status:'draft',platform:platforms[0],scheduledAt:null,...clip.publishing};}
 function postText(p){return [p.title,p.caption,p.cta,p.hashtags].filter(Boolean).join('\n\n');}
 function starter(clip,style){
  const text=String(clip.transcript||'').replace(/\s+/g,' ').trim();
  if(!text)return '';
  const excerpt=text.length>700?text.slice(0,697)+'…':text;
  const lead={takeaway:'One idea worth saving:',question:'What do you think about this?',story:'A moment from the conversation:'}[style]||'One idea worth saving:';
  return lead+'\n\n'+excerpt;
 }
 function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function csv(entries){return '\uFEFF'+[['Project','Clip','Platform','Status','Planned time (UTC)','Post text','Production notes'],...entries.map(({clip,project})=>{const p=defaults(clip);return [project,p.title,p.platform,p.status,p.scheduledAt||'',postText(p),p.notes];})].map(row=>row.map(csvCell).join(',')).join('\r\n');}
 function brief(clip){const p=defaults(clip);return `${p.title}\n${'='.repeat(40)}\nPlatform: ${p.platform}\nStatus: ${p.status}\nPlanned time: ${p.scheduledAt||'Not set'}\nDuration: ${Number(clip.duration||0).toFixed(1)} seconds\n\nPOST TEXT\n${postText(p)}\n\nPRODUCTION NOTES\n${p.notes||'None'}\n\nTRANSCRIPT\n${clip.transcript||'Unavailable. Enable captions when generating clips to transcribe audio.'}\n\nPlanning only. Clippfy does not publish automatically.\n`;}
 function calendar(clip){const p=defaults(clip);if(!p.scheduledAt)throw new Error('Set a planned date first.');const stamp=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const escape=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Clippfy//Publishing Planner//EN','BEGIN:VEVENT',`UID:${String(clip.jobId||'clip').replace(/[^a-zA-Z0-9-]/g,'')}-${Number(clip.index)||0}@clippfy`,`DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(p.scheduledAt)}`,`DTEND:${stamp(Date.parse(p.scheduledAt)+15*60000)}`,`SUMMARY:${escape('Publish: '+p.title)}`,`DESCRIPTION:${escape(p.platform+'\n'+postText(p)+'\n\nManual publishing reminder. Not auto-posted by Clippfy.')}`,'END:VEVENT','END:VCALENDAR'];
  // Fold by UTF-8 octets, not JS character count (RFC 5545).
  return lines.map(line=>{let out='',part='',size=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(size+n>73){out+=part+'\r\n';part=' ';size=1;}part+=char;size+=n;}return out+part;}).join('\r\n')+'\r\n';
 }
 return {statuses,platforms,validate,defaults,postText,starter,csv,brief,calendar};
});
