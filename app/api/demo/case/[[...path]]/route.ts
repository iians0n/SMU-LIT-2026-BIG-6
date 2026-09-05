import { api,requireCase,ApiError } from '@/lib/server/session';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{path?:string[]}>}){return api(request,async()=>{const c=requireCase(request);const {path}=await context.params;const key=path?.join('/');if(!key)return c;switch(key){case 'facts':return c.facts;case 'documents':return c.documents;case 'issues':return c.issues;case 'contradictions':return c.contradictions;default:throw new ApiError(404,'Resource not found.');}});}
