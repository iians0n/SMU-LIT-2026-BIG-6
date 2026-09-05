import { z } from 'zod';
import { SourceRefSchema } from '@/lib/contracts';
import { api,requireCase,checkVersion,ApiError } from '@/lib/server/session';
import { getWorkflow,appendVerification } from '@/lib/workflow';
import { assembleDraft,renderDraft,validateEdit,isRenderable } from '@/lib/drafting';
import { loadContradictions } from '@/lib/server/contradictions';
export async function GET(request:Request){return api(request,()=>getWorkflow(requireCase(request)).draft);}
const schema=z.object({version:z.number().int(),action:z.enum(['refresh','edit','review','acknowledge']),id:z.string().optional(),value:z.string().max(12000).optional(),sourceRef:SourceRefSchema.nullable().optional(),acknowledged:z.boolean().optional()});
export async function POST(request:Request){return api(request,async()=>{const c=requireCase(request);const b=schema.parse(await request.json());checkVersion(c,b.version);const w=getWorkflow(c);
 if(b.action==='refresh'){const contradictions=await loadContradictions(request);checkVersion(requireCase(request),c.version);w.draft=assembleDraft(c,contradictions);}
 else {checkVersion(c,w.draft.sourceCaseVersion);if(b.action==='acknowledge')w.draft.gapsAcknowledged=b.acknowledged===true;
 else {const f=w.draft.fields.find(f=>f.id===b.id);if(!f)throw new ApiError(404,'Draft field not found.');const before=f.value;
 if(b.action==='edit'){const value=b.value??'';const ref=b.sourceRef??f.sourceRef;const error=validateEdit(f,value,ref,c);if(error)throw new ApiError(422,error);f.value=value;f.sourceRef=ref;f.reviewedAt=null;w.draft.gapsAcknowledged=false;}
 else {if(!f.value||!isRenderable(f,c))throw new ApiError(422,'Review requires a populated field with a valid source.');f.reviewedAt=new Date().toISOString();}
 appendVerification(c,{action:b.action==='edit'?'edited':'reviewed',description:`${f.label} ${b.action}`,sourceCaseVersion:c.version,sourceRefs:f.sourceRef?[f.sourceRef,...f.additionalSourceRefs]:[],fieldId:f.id,aiDrafted:f.aiDrafted,before,after:f.value});}}
 w.draft.renderedDraft=renderDraft(w.draft,c);w.draft.gaps=w.draft.fields.filter(f=>f.required&&!f.value).map(f=>f.label);
 if(b.action==='refresh'||b.action==='acknowledge')appendVerification(c,{action:b.action==='refresh'?'generated':'gaps_acknowledged',description:`Draft ${b.action}`,sourceCaseVersion:c.version,sourceRefs:[],aiDrafted:false});return w.draft;});}
