const B=require('./backend');
async function access(sb,user){
 const admin=!!B.checked(await sb.rpc('is_clippfy_admin'));
 if(admin)return {admin:true,plan:'admin',clipLimit:null,projectLimit:null,storageLimit:null};
 const grant=B.checked(await sb.from('clippfy_access').select('plan,expires_at').eq('user_id',user.id).maybeSingle());
 const plan=grant&&(!grant.expires_at||Date.parse(grant.expires_at)>Date.now())?grant.plan:'free';
 const limits={free:[30,30,500*1024**2],starter:[30,30,1024**3],clipper:[100,100,5*1024**3],pro:[300,300,10*1024**3]};
 const [clipLimit,projectLimit,storageLimit]=limits[plan]||limits.free;
 return {admin:false,plan,clipLimit,projectLimit,storageLimit,expiresAt:grant?.expires_at||null};
}
const exceeds=(limit,value)=>limit!==null&&value>limit;
module.exports={access,exceeds};
