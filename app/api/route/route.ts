import { z } from 'zod';
import { api,requireCase,checkVersion } from '@/lib/server/session';
import { getWorkflow,appendVerification } from '@/lib/workflow';
import { screenRoute } from '@/lib/rules/rules.v1';
export async function GET(request:Request){return api(request,()=>getWorkflow(requireCase(request)).route);}
export async function POST(request:Request){return api(request,async()=>{const c=requireCase(request);const b=z.object({version:z.number().int(),action:z.enum(['refresh','review'])}).parse(await request.json());checkVersion(c,b.version);const w=getWorkflow(c);if(b.action==='refresh')w.route=screenRoute(c);else {checkVersion(c,w.route.sourceCaseVersion);w.route.reviewed=true;}appendVerification(c,{action:b.action==='refresh'?'generated':'reviewed',description:`Route ${b.action}`,sourceCaseVersion:c.version,sourceRefs:[],aiDrafted:false});return w.route;});}
