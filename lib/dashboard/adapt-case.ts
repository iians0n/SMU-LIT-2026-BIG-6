import type { CaseRecord, DocumentIssue, Fact as SharedFact } from '@/lib/contracts';
import type { Case, Document, Fact, SourceRef } from './contracts';

/**
 * The amount calculation has to be built from what the record shows, not from
 * what the user is asking for.
 *
 * desired_outcome used to map to claim_component_cents, so the "calculation"
 * simply echoed the figure the claimant named and could never disagree with it.
 * FR08 wants an amount traceable to confirmed facts, and the whole point of
 * showing a calculation is that it can come out different from the ask - which
 * is exactly what happens on the adverse case, where a refund the claimant did
 * not mention means the two no longer reconcile.
 *
 * Components are what she paid and what it cost her; refunds come back off.
 */
const REFUND=/\brefund(ed|s)?\b/i;
const factKey=(fact:SharedFact,index:number)=>{
 if(fact.kind==='agreement')return 'agreement';
 if(fact.kind==='promised_performance')return 'completion_date';
 if(fact.kind==='event'&&fact.statement.toLowerCase().includes('not finish'))return 'alleged_failure';
 // Before the refund test: "Refund of S$2,000 plus S$500" is what she is
 // ASKING for, not money she received, and treating it as one cancelled the
 // whole claim out to zero.
 if(fact.kind==='desired_outcome')return 'requested_amount_cents';
 if(fact.amount&&REFUND.test(fact.statement))return 'refund_cents';
 if(fact.amount&&(fact.kind==='payment'||fact.kind==='loss'))return 'claim_component_cents';
 return `${fact.kind}_${index}`;
};
const issueStatus=(issues:DocumentIssue[]):Document['processingStatus']=>{
 if(issues.includes('password_protected'))return 'password_protected';
 if(issues.includes('unsupported_type'))return 'unsupported';
 if(issues.includes('truncated'))return 'truncated';
 if(issues.includes('possibly_unrelated'))return 'possibly_unrelated';
 if(issues.includes('unreadable')||issues.includes('low_quality_scan'))return 'unreadable';
 return 'ready';
};

export function adaptCaseRecord(record:CaseRecord,ownerId=record.case.ownerId):Case{
 const sourceRefs=(fact:SharedFact):SourceRef[]=>fact.excerptIds.map(id=>({kind:'excerpt',id}));
 const facts:Fact[]=record.facts.map((fact,index)=>({id:fact.id,key:factKey(fact,index),label:fact.statement,value:fact.amount?.minorUnits??fact.date?.value??fact.statement,origin:fact.origin,confirmedByUser:fact.confirmedByUser,disputed:fact.disputed,unknown:fact.unknown,sourceLinks:sourceRefs(fact),extractionConfidence:fact.excerptIds.length?Math.min(...fact.excerptIds.map(id=>record.excerpts.find(e=>e.id===id)?.extractionConfidence??0)):null}));
 for(const party of record.parties){facts.push({id:`party-${party.id}`,key:`${party.role}_name`,label:`${party.role==='claimant'?'Your':'Respondent'} name`,value:party.name,origin:'user_stated',confirmedByUser:!!party.name,disputed:false,unknown:!party.name,sourceLinks:[],extractionConfidence:null});}
 const desired=record.facts.find(f=>f.kind==='desired_outcome'&&f.confirmedByUser&&!f.disputed&&!f.unknown&&f.amount);
 const dateFact=record.facts.find(f=>f.kind==='promised_performance'&&f.date);
 return {id:record.case.id,ownerId,version:record.case.version,title:'Repair work dispute',claimType:record.case.claimCategory==='goods_and_services'?'services':record.case.claimCategory,amountCents:desired?.amount?.minorUnits??null,causeOfActionDate:dateFact?.date?.value??null,dateUncertain:!dateFact?.date||dateFact.date.precision!=='exact'||dateFact.disputed,consent:'not_confirmed',exceptionalCircumstances:'none',currentStage:['explain','clarify_upload','confirm','review_support','choose_step','prepare_handoff'].indexOf(record.case.stage)+1,parties:record.parties.map(p=>({id:p.id,role:p.role,type:p.kind==='business'?'business':'individual',name:p.name??'',address:p.address??null,location:p.inSingapore===true?'singapore':p.inSingapore===false?'overseas':'unknown',sourceRefs:[]})),facts,documents:record.documents.map(doc=>({id:doc.id,name:doc.fileName,hash:doc.hash,processingStatus:doc.processingStatus==='processing'||doc.processingStatus==='pending'?'processing':doc.processingStatus==='failed'?issueStatus(doc.issues):issueStatus(doc.issues),updatedAt:doc.uploadedAt,excerpts:record.excerpts.filter(e=>e.documentId===doc.id).map(e=>({id:e.id,documentId:e.documentId,text:e.text,page:e.anchor.page,region:e.anchor.kind==='region'?JSON.stringify(e.anchor.bbox):undefined}))})),events:record.facts.filter(f=>f.date).map(f=>({id:`event-${f.id}`,date:f.date?.value??null,label:f.statement,sourceRefs:sourceRefs(f).length?sourceRefs(f):[{kind:'fact' as const,id:f.id}]})),issues:record.issues.map(i=>({id:i.id,title:i.label,checklistVersion:i.checklistVersion,factIds:i.factIds,supportingExcerptIds:i.supportingExcerptIds,conflictingExcerptIds:i.conflictingExcerptIds,supportStatus:i.supportStatus,reason:i.reason,nextQuestion:i.nextQuestion??'',contraryExplanation:i.contraryExplanations.join(' ')||'No contrary explanation was identified in the reviewed material.'})),contradictions:record.contradictions.map(c=>({id:c.id,description:c.description,question:c.alternatives[0]?.distinguishingFact??'What information would resolve this point?',interpretations:c.alternatives.map(a=>a.reading),sourceRefs:[...c.excerptIds.map(id=>({kind:'excerpt' as const,id})),...c.factIds.map(id=>({kind:'fact' as const,id}))],resolved:false})),unresolvedQuestions:record.openQuestions.filter(q=>q.status==='open'||q.status==='dont_know').map(q=>q.question)};
}
