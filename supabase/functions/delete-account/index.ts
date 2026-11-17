import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{error:'POST requis'});
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return reply(401,{error:'Connexion requise'});
  const url=Deno.env.get('SUPABASE_URL')!;
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  // Validate the supplied user token remotely. Never accept a user id from the body.
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return reply(401,{error:'Session invalide'});
  try {
    const body=await req.json();
    if(body.confirm!==true)return reply(400,{error:'Confirmation requise'});
    if(body.owner!==user.id)return reply(409,{error:'Le compte a changé. Recharge avant de continuer.'});
    const {error:markError}=await admin.from('user_accounts').upsert({user_id:user.id,deletion_pending:true});
    if(markError)throw markError;
    // Once marked, RLS blocks uploads and the save RPC blocks writes on all devices.
    // Remove from the first page repeatedly, so deleting doesn't shift an offset.
    for(let batch=0;batch<1000;batch++){
      const {data,error}=await admin.storage.from('vision-images').list(user.id,{limit:100});
      if(error)throw error;if(!data?.length)break;
      const {error:removeError}=await admin.storage.from('vision-images').remove(data.map(f=>`${user.id}/${f.name}`));
      if(removeError)throw removeError;
      if(batch===999)throw new Error('Réessaie pour terminer la suppression des images.');
    }
    const {error}=await admin.auth.admin.deleteUser(user.id);
    if(error)throw error;
    return reply(200,{deleted:true});
  }catch(err){console.error('Suppression incomplète',err);return reply(500,{error:'Suppression incomplète. Réessaie pour la terminer.'});}
});
