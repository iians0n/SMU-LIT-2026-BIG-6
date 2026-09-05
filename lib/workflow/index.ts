import { randomUUID } from 'node:crypto';
import type { Case, Draft, Option, RouteScreening, Task, VerificationEvent } from '@/lib/dashboard/contracts';
import { assembleDraft } from '@/lib/drafting';
import { screenRoute } from '@/lib/rules/rules.v1';
import { getCase,patchCase } from '@/lib/store';
import { VERIFICATION_EVENT_LABEL, type VerificationEvent as SharedVerificationEvent } from '@/lib/contracts';
import { adaptCaseRecord } from '@/lib/dashboard/adapt-case';
import { assessEvidence } from '@/lib/assessment/evaluate';
import { detectContradictions } from '@/lib/assessment/contradictions';
export interface Workflow { caseId:string;route:RouteScreening;tasks:Task[];draft:Draft;option:Option|null;verification:VerificationEvent[]; }
export function createTasks(c:Case):Task[] {
 const task=(id:string,title:string,purpose:string,assertionId:string,requiredMaterial:string[],dependencies:string[]=[]):Task=>({id,title,purpose,assertionId,requiredMaterial,dependencies,status:'Not started',sourceCaseVersion:c.version});
 const tasks=[task('facts','Review the confirmed account','Check names, dates and what remains uncertain.','responsibility',['Confirmed facts','Original documents']),task('route','Review the filing route','Understand the screening result and its limitations.','assessment',['Claim type','Amount','Relevant event date','Respondent location']),task('assessment','Complete the CJTS pre-filing assessment','Keep the genuine ID supplied by CJTS.','assessment',['Official assessment ID'],['route']),task('draft','Review the preparation draft','Compare each field with its linked source.','responsibility',['Draft','Sources'],['facts']),task('documents','Prepare supporting PDFs','Organise relevant material for your claim.','filing',['Supporting PDFs'])];
 if(c.parties.some(p=>p.role==='respondent'&&p.type==='business'))tasks.push(task('acra','Obtain the respondent’s ACRA profile','Check the current registered details.','acra',['ACRA profile obtained within one month of filing']));
 if((c.amountCents??0)>2000000&&(c.amountCents??0)<=3000000)tasks.push(task('consent','Prepare the Memorandum of Consent','Record genuine consent from both parties.','consent',['Signed Memorandum of Consent']));
 return tasks;
}
const globalWorkflow=globalThis as unknown as {casepathWorkflows?:Map<string,Workflow>};
const workflows=globalWorkflow.casepathWorkflows??=new Map<string,Workflow>();
function buildWorkflow(c:Case,option:Option|null=null):Workflow {
 return {caseId:c.id,route:screenRoute(c),tasks:createTasks(c),draft:assembleDraft(c,c.contradictions),option,verification:[]};
}
export function getWorkflow(c:Case):Workflow {
 const existing=workflows.get(c.ownerId);
 if(!existing)workflows.set(c.ownerId,buildWorkflow(c));
 else if(existing.caseId!==c.id||existing.route.sourceCaseVersion!==c.version||existing.draft.sourceCaseVersion!==c.version||existing.tasks.some(t=>t.sourceCaseVersion!==c.version)){
  const rebuilt=buildWorkflow(c,existing.option);
  rebuilt.verification=existing.verification;
  if(rebuilt.option==='file'&&rebuilt.route.outcome!=='appears_supported')rebuilt.option=null;
  workflows.set(c.ownerId,rebuilt);
 }
 return workflows.get(c.ownerId)!;
}

/** Keep all rule-derived shared fields aligned with the material case version. */
export function synchroniseDerivedCase():void {
 const record=getCase();
 const current=record.issues.length===6&&record.issues.every(issue=>issue.sourceCaseVersion===record.case.version)
  &&record.contradictions.every(item=>item.sourceCaseVersion===record.case.version);
 if(current)return;
 const contradictions=detectContradictions(record);
 const issues=assessEvidence(record,contradictions);
 patchCase(draft=>{draft.contradictions=contradictions;draft.issues=issues;});
 invalidateWorkflowCaches();
}

/** Used by the case endpoint so a fresh or reset browser case is never blank. */
export function currentCaseWithDerivedState(){
 synchroniseDerivedCase();
 return getCase();
}

/** Refresh every cached session on its next read after a shared-record mutation. */
export function invalidateWorkflowCaches():void {
 for(const [owner,workflow] of workflows){
  const c=adaptCaseRecord(getCase(),owner);
  if(workflow.route.sourceCaseVersion!==c.version)getWorkflow(c);
 }
}
export function appendVerification(c:Case,input:Omit<VerificationEvent,'id'|'caseId'|'actorId'|'timestamp'>) {
 const event:VerificationEvent={...input,id:randomUUID(),caseId:c.id,actorId:c.ownerId,timestamp:new Date().toISOString()};
 getWorkflow(c).verification.push(event);
 patchCase(record=>record.verificationEvents.push({id:event.id,kind:input.action==='edited'?'user_corrected':input.aiDrafted?'ai_drafted':'user_reviewed',affectedOutput:input.fieldId?`draftField:${input.fieldId}`:`dashboard:${input.action}`,usedFactIds:input.sourceRefs.filter(r=>r.kind==='fact').map(r=>r.id),usedSourceIds:[],note:input.description,at:event.timestamp,caseVersion:c.version}));
 return event;
}
export function clearWorkflow(owner:string){workflows.delete(owner);}

/**
 * The verification record for FR11, drawn from both halves.
 *
 * appendVerification writes dashboard events into the shared record as well as
 * the workflow store, but the intake and extraction pipeline writes only to the
 * shared record - so reading the workflow store alone showed every draft edit
 * and no evidence of how any fact got there. FR11 wants the record to show
 * which parts were AI-drafted and which facts and sources were used, and
 * extraction is the largest AI contribution in the product.
 *
 * The shared record is the source of truth; workflow entries that already
 * mirror one are dropped by id.
 */
const ACTION_FOR:Record<SharedVerificationEvent['kind'],VerificationEvent['action']>={
 ai_drafted:'generated',ai_extracted:'generated',ai_suggested:'generated',assertion_withheld:'generated',
 user_corrected:'edited',user_confirmed:'reviewed',user_reviewed:'reviewed',
};
const AI_KINDS=new Set(['ai_drafted','ai_extracted','ai_suggested','assertion_withheld']);

export function verificationRecord(c:Case):VerificationEvent[] {
 const own=getWorkflow(c).verification;
 const mirrored=new Set(own.map(e=>e.id));
 const shared=getCase().verificationEvents.filter(e=>!mirrored.has(e.id)).map((e):VerificationEvent=>({
  id:e.id,caseId:c.id,actorId:c.ownerId,timestamp:e.at,
  action:ACTION_FOR[e.kind]??'reviewed',
  description:e.note??`${VERIFICATION_EVENT_LABEL[e.kind]} — ${e.affectedOutput.replace(':',' ')}`,
  sourceCaseVersion:Math.max(1,e.caseVersion),
  sourceRefs:e.usedFactIds.map(id=>({kind:'fact' as const,id})),
  fieldId:e.affectedOutput,
  aiDrafted:AI_KINDS.has(e.kind),
 }));
 return [...own,...shared].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
