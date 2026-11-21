const B=require('./backend');
async function access(sb,user){
 const admin=!!B.checked(await sb.rpc('is_clippfy_admin'));
 if(admin)return {admin:true,plan:'admin',clipLimit:null,projectLimit:null,storageLimit:null};
 const grant=B.checked(await sb.from('clippfy_access').select('plan,expires_at').eq('user_id',user.id).maybeSingle());
 const plan=grant&&(!grant.expires_at||Date.parse(grant.expires_at)>Date.now())?grant.plan:'free';
 const plans=require('../assets/plans.json');
 const limits={free:[30,30,500*1024**2],...Object.fromEntries(['starter','clipper','pro'].map(key=>[key,[plans[key].clips,plans[key].clips,plans[key].storage*1024**3]]))};
 const [clipLimit,projectLimit,storageLimit]=limits[plan]||limits.free;
 return {admin:false,plan,clipLimit,projectLimit,storageLimit,expiresAt:grant?.expires_at||null};
}
const exceeds=(limit,value)=>limit!==null&&value>limit;
module.exports={access,exceeds};

// Check net stored growth, including outputs and replacement edits, against the current plan.
async function ensureStorageCapacity(sb,user,additionalBytes){
 const a=await access(sb,user);if(a.storageLimit===null)return;
 const rows=[];for(let offset=0;;offset+=1000){const batch=B.checked(await sb.from('jobs').select('payload').eq('user_id',user.id).range(offset,offset+999));rows.push(...batch);if(batch.length<1000)break;}
 if(exceeds(a.storageLimit,B.storageUsage(rows)+additionalBytes))throw B.fail('Your plan storage is full. Delete projects or upgrade your plan to store more.',409);
}
module.exports.ensureStorageCapacity=ensureStorageCapacity;
