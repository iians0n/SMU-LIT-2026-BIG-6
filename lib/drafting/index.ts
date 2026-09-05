import type { Case, Contradiction, Draft, DraftField, SourceRef } from '@/lib/contracts';
export function sourceValue(c:Case,ref:SourceRef|null):string|null {
 if(!ref)return null;
 if(ref.kind==='fact'){const f=c.facts.find(f=>f.id===ref.id);return f&&f.confirmedByUser&&!f.unknown&&f.value!==null?String(f.value):null;}
 for(const d of c.documents){if(d.processingStatus!=='ready')continue;const e=d.excerpts.find(e=>e.id===ref.id);if(e)return e.text;}
 return null;
}
export const money=(cents:number)=>`S$${new Intl.NumberFormat('en-SG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100)}`;
export function isRenderable(field:DraftField,c:Case):boolean {return !field.value || (!!field.sourceRef&&sourceValue(c,field.sourceRef)!==null&&field.additionalSourceRefs.every(ref=>sourceValue(c,ref)!==null));}
export function amountCalculation(c:Case) {
 const entries=c.facts.filter(f=>['claim_component_cents','refund_cents'].includes(f.key));
 const accepted=entries.filter(f=>f.confirmedByUser&&!f.disputed&&!f.unknown&&Number.isSafeInteger(f.value)&&Number(f.value)>=0);
 const total=accepted.reduce((sum,f)=>sum+(f.key==='refund_cents'?-1:1)*Number(f.value),0);
 const complete=entries.length>0&&entries.length===accepted.length&&total>=0&&Number.isSafeInteger(total)&&accepted.some(f=>f.key==='claim_component_cents');
 return {total:complete?total:null,entries:accepted,complete};
}
export function assembleDraft(c:Case,contradictions:Contradiction[]|null):Draft {
 const fields:DraftField[]=[];
 const add=(id:string,section:DraftField['section'],label:string,value:string,ref:SourceRef|null,required=false,extra:SourceRef[]=[])=>fields.push({id,section,label,value,sourceRef:ref,additionalSourceRefs:extra,required,sourceCaseVersion:c.version,reviewedAt:null,aiDrafted:false});
 const fact=(key:string)=>c.facts.find(f=>f.key===key&&f.confirmedByUser&&!f.unknown&&f.value!==null);
 for(const [key,label] of [['agreement','Agreed work'],['alleged_failure','Your account']] as const){const f=fact(key);add(key,'summary',label,f?String(f.value):'',f?{kind:'fact',id:f.id}:null,true);}
 const active=contradictions?.filter(x=>!x.resolved)??[];
 for(const x of active){const refs=x.sourceRefs.filter(r=>sourceValue(c,r)!==null);add(`uncertainty-${x.id}`,'summary','Unresolved point',x.description,refs[0]??null,true,refs.slice(1));}
 for(const event of [...c.events].sort((a,b)=>(a.date??'9999').localeCompare(b.date??'9999'))){add(event.id,'chronology',event.date??'Date unknown',event.label,event.sourceRefs[0]??null,false,event.sourceRefs.slice(1));}
 for(const doc of c.documents){const e=doc.excerpts[0];add(doc.id,'evidence',doc.name,`${doc.name} · ${doc.processingStatus.replaceAll('_',' ')} · ${doc.excerpts.length} excerpt(s)`,e?{kind:'excerpt',id:e.id}:null);}
 const calc=amountCalculation(c);
 for(const f of calc.entries)add(`amount-${f.id}`,'amount',f.label,`${f.key==='refund_cents'?'− ':''}${money(Number(f.value))}`,{kind:'fact',id:f.id});
 add('total','amount','Calculated requested amount',calc.total===null?'':money(calc.total),calc.total!==null?{kind:'fact',id:calc.entries[0].id}:null,true,calc.entries.slice(1).map(f=>({kind:'fact',id:f.id})));
 for(const [key,label] of [['claimant_name','Your name'],['claimant_address','Your address'],['claimant_email','Your email'],['claimant_phone','Your phone'],['respondent_name','Respondent name'],['respondent_address','Respondent address'],['assessment_id','CJTS pre-filing assessment ID']] as const){const f=fact(key);add(key,'worksheet',label,f?String(f.value):'',f?{kind:'fact',id:f.id}:null,true);}
 const gaps=fields.filter(f=>f.required&&!f.value).map(f=>f.label);
 const warnings=[...active.map(x=>x.question)];
 if(contradictions===null)warnings.unshift('Contradiction review is unavailable. The narrative is not ready for transfer.');
 if(calc.total!==null&&calc.total!==c.amountCents)warnings.push('The confirmed calculation differs from the recorded claim amount. Review the case record.');
 const draft={fields,renderedDraft:'',sourceCaseVersion:c.version,gaps,gapsAcknowledged:false,warnings,contradictionsAvailable:contradictions!==null};
 draft.renderedDraft=renderDraft(draft,c);return draft;
}
export function renderDraft(draft:Draft,c:Case):string {
 return draft.fields.filter(f=>f.section==='summary').map(f=>isRenderable(f,c)&&f.value?f.value:`[${f.label}: source or information missing]`).join('\n\n');
}
export function readyForTransfer(d:Draft,c:Case):boolean {
 return d.sourceCaseVersion===c.version&&d.contradictionsAvailable&&d.fields.every(f=>isRenderable(f,c)&&(!f.value||!!f.reviewedAt))&&d.gapsAcknowledged&&!d.warnings.some(w=>w.includes('differs from'));
}
const prohibited=/\b(fabricat\w*|forge\w*|guaranteed\s+win|definitely\s+win|strengthen\s+(?:the\s+)?evidence|hide\s+(?:the\s+)?(?:evidence|refund))\b/i;
export function validateEdit(field:DraftField,value:string,ref:SourceRef|null,c:Case):string|null {
 if(prohibited.test(value))return 'The draft cannot fabricate, strengthen, or hide evidence.';
 if(field.id.startsWith('uncertainty-')&&value!==field.value)return 'An unresolved point must remain in the narrative. Resolve it in the case record first.';
 if(field.section==='amount'&&value!==field.value)return 'Amounts are calculated from confirmed facts. Correct the case record to change the calculation.';
 if(!value)return field.required?'A required populated field cannot be removed. Correct the case record instead.':null;
 const source=sourceValue(c,ref);if(source===null)return 'Choose a confirmed fact or readable excerpt as the source.';
 if(value===field.value&&JSON.stringify(ref)===JSON.stringify(field.sourceRef))return null;
 // Conservative P0 edit gate: exact source or a contiguous excerpt. No model can certify a rewrite.
 if(!source.includes(value))return 'Use wording present in the selected source. New facts or a substantive rewrite must be confirmed in the case record first.';
 return null;
}
