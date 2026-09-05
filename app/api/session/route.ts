import { api,COOKIE,createSession } from '@/lib/server/session';
export const dynamic='force-dynamic';
export async function POST(request:Request){return api(request,()=>{const token=createSession(request);return Response.json({ok:true},{headers:{'Set-Cookie':`${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/${process.env.NODE_ENV==='production'?'; Secure':''}`,'Cache-Control':'no-store'}});});}
