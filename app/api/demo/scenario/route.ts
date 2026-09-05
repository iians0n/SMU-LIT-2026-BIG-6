import { z } from 'zod';
import { api,requireCase,checkVersion } from '@/lib/server/session';
import { caseStore } from '@/lib/store';
import { appendVerification } from '@/lib/workflow';
const schema=z.object({scenario:z.enum(['unsupported','changed_amount','uncertain','supported']),version:z.number().int()});
export async function POST(request:Request){return api(request,async()=>{const c=requireCase(request);const body=schema.parse(await request.json());checkVersion(c,body.version);let patch={};
 if(body.scenario==='unsupported')patch={claimType:'employment'};
 if(body.scenario==='changed_amount')patch={amountCents:225000,facts:c.facts.map(f=>f.key==='claim_component_cents'?{...f,value:225000}:f)};
 if(body.scenario==='uncertain')patch={dateUncertain:true};
 if(body.scenario==='supported')patch={claimType:'services',dateUncertain:false,causeOfActionDate:'2026-07-22',contradictions:c.contradictions.map(x=>({...x,resolved:true})),facts:c.facts.map(f=>f.id==='f-date'?{...f,value:'2026-07-22',disputed:false}:f)};
 const next=caseStore.patchCase(c.ownerId,patch,c.version);appendVerification(next,{action:'case_updated',description:`Synthetic demo scenario: ${body.scenario}`,sourceCaseVersion:next.version,sourceRefs:[],aiDrafted:false});return next;});}
