import { randomBytes } from 'node:crypto';
import { getCase } from '@/lib/store';
import type { Case } from '@/lib/dashboard/contracts';
import { adaptCaseRecord } from '@/lib/dashboard/adapt-case';
const state=globalThis as unknown as {casepathSessions?:Map<string,{owner:string;expires:number}>};
const sessions=state.casepathSessions??=new Map<string,{owner:string;expires:number}>();
export const COOKIE='casepath_session';
export function tokenFrom(request:Request){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);}
export function createSession(request:Request){const existing=tokenFrom(request);if(existing&&sessions.has(existing)&&sessions.get(existing)!.expires>Date.now())return existing;const token=randomBytes(32).toString('hex');sessions.set(token,{owner:randomBytes(16).toString('hex'),expires:Date.now()+24*60*60*1000});return token;}
export function requireCase(request:Request):Case {
 const token=tokenFrom(request);const session=token?sessions.get(token):undefined;if(!session||session.expires<Date.now())throw new ApiError(401,'Your demo session has ended. Reload to start a new session.');
 const c=adaptCaseRecord(getCase(),session.owner);const requested=new URL(request.url).searchParams.get('caseId');
 if(requested&&requested!==c.id)throw new ApiError(404,'Case not found.');return c;
}
export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
export function checkVersion(c:Case,version:number){if(version!==c.version)throw new ApiError(409,'The case changed. Reload and review the latest version.');}
export function checkOrigin(request:Request){
 const origin=request.headers.get('origin');if(!origin)return;
 const supplied=new URL(origin),requestUrl=new URL(request.url);
 const allowedHosts=[requestUrl.host,request.headers.get('host'),request.headers.get('x-forwarded-host')].filter(Boolean);
 const expectedProtocol=request.headers.get('x-forwarded-proto')??requestUrl.protocol.replace(':','');
 if(!allowedHosts.includes(supplied.host)||supplied.protocol!==`${expectedProtocol}:`)throw new ApiError(403,'Request origin is not allowed.');
}
export async function api(request:Request,handler:()=>unknown|Promise<unknown>):Promise<Response>{
 try {if(request.method!=='GET')checkOrigin(request);const result=await handler();return result instanceof Response?result:Response.json(result,{headers:{'Cache-Control':'no-store'}});}
 catch(e){return Response.json({error:e instanceof Error?e.message:'The request could not be completed.'},{status:e instanceof ApiError?e.status:400,headers:{'Cache-Control':'no-store'}});}
}
