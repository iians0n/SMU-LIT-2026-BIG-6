import { randomUUID } from 'node:crypto';
import type { Case, Draft, Option, RouteScreening, Task, VerificationEvent } from '@/lib/dashboard/contracts';
import { assembleDraft } from '@/lib/drafting';
import { screenRoute } from '@/lib/rules/rules.v1';
import { patchCase } from '@/lib/store';
export interface Workflow { route:RouteScreening;tasks:Task[];draft:Draft;option:Option|null;verification:VerificationEvent[]; }
export function createTasks(c:Case):Task[] {
 const task=(id:string,title:string,purpose:string,assertionId:string,requiredMaterial:string[],dependencies:string[]=[]):Task=>({id,title,purpose,assertionId,requiredMaterial,dependencies,status:'Not started',sourceCaseVersion:c.version});
 const tasks=[task('facts','Review the confirmed account','Check names, dates and what remains uncertain.','responsibility',['Confirmed facts','Original documents']),task('route','Review the filing route','Understand the screening result and its limitations.','assessment',['Claim type','Amount','Relevant event date','Respondent location']),task('assessment','Complete the CJTS pre-filing assessment','Keep the genuine ID supplied by CJTS.','assessment',['Official assessment ID'],['route']),task('draft','Review the preparation draft','Compare each field with its linked source.','responsibility',['Draft','Sources'],['facts']),task('documents','Prepare supporting PDFs','Organise relevant material for your claim.','filing',['Supporting PDFs'])];
 if(c.parties.some(p=>p.role==='respondent'&&p.type==='business'))tasks.push(task('acra','Obtain the respondent’s ACRA profile','Check the current registered details.','acra',['ACRA profile obtained within one month of filing']));
 if((c.amountCents??0)>2000000&&(c.amountCents??0)<=3000000)tasks.push(task('consent','Prepare the Memorandum of Consent','Record genuine consent from both parties.','consent',['Signed Memorandum of Consent']));
 return tasks;
}
const globalWorkflow=globalThis as unknown as {casepathWorkflows?:Map<string,Workflow>};
const workflows=globalWorkflow.casepathWorkflows??=new Map<string,Workflow>();
export function getWorkflow(c:Case):Workflow {
 if(!workflows.has(c.ownerId))workflows.set(c.ownerId,{route:screenRoute(c),tasks:createTasks(c),draft:assembleDraft(c,c.contradictions),option:null,verification:[]});
 return workflows.get(c.ownerId)!;
}
export function appendVerification(c:Case,input:Omit<VerificationEvent,'id'|'caseId'|'actorId'|'timestamp'>) {
 const event:VerificationEvent={...input,id:randomUUID(),caseId:c.id,actorId:c.ownerId,timestamp:new Date().toISOString()};
 getWorkflow(c).verification.push(event);
 patchCase(record=>record.verificationEvents.push({id:event.id,kind:input.action==='edited'?'user_corrected':input.aiDrafted?'ai_drafted':'user_reviewed',affectedOutput:input.fieldId?`draftField:${input.fieldId}`:`dashboard:${input.action}`,usedFactIds:input.sourceRefs.filter(r=>r.kind==='fact').map(r=>r.id),usedSourceIds:[],note:input.description,at:event.timestamp,caseVersion:c.version}));
 return event;
}
export function clearWorkflow(owner:string){workflows.delete(owner);}
