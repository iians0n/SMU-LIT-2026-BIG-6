import { ContradictionSchema } from '@/lib/contracts';
export async function loadContradictions(request:Request){
 // Same public seam as the real pipeline. Fallback rewrites supply the fixture until it lands.
 try {const url=new URL('/api/case/contradictions',request.url);const response=await fetch(url,{headers:{cookie:request.headers.get('cookie')??''},cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)return null;return ContradictionSchema.array().parse(await response.json());}catch{return null;}
}
