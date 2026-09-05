import { describe,it,expect } from 'vitest';
import { demoCase } from '@/fixtures/case.demo';
import { stale } from '@/lib/dashboard/contracts';
import { adaptCaseRecord } from '@/lib/dashboard/adapt-case';
import { screenRoute } from '@/lib/rules/rules.v1';
import { sources,assertions,validateAssertion } from '@/lib/retrieval';
import { assembleDraft,amountCalculation,isRenderable,validateEdit,readyForTransfer,renderDraft } from '@/lib/drafting';
import { createTasks } from '@/lib/workflow';
const now=new Date('2026-09-05T12:00:00Z');
const sample=()=>adaptCaseRecord(structuredClone(demoCase),'test-owner');
describe('contract and source provenance',()=>{
 it('adapts the shared fixture and keeps confirmation distinct from origin',()=>{const c=sample();const stated=c.facts.find(f=>f.origin==='user_stated')!;expect(stated.confirmedByUser).toBe(true);expect(c.issues.some(i=>i.supportStatus==='partial_or_disputed')).toBe(true);});
 it('accepts only approved statements with the matching passage',()=>{expect(validateAssertion(assertions.limits,sources,now).ok).toBe(true);expect(validateAssertion({...assertions.limits,text:'You will win'},sources,now).ok).toBe(false);expect(validateAssertion({...assertions.limits,sourceId:'FAKE'},sources,now).ok).toBe(false);});
 it.each(['unavailable','stale','missing-passage','untrusted-domain'] as const)('withholds %s sources',kind=>{const library=structuredClone(sources);const s=library[0];if(kind==='unavailable')s.available=false;if(kind==='stale')s.reviewedAt='2020-01-01';if(kind==='missing-passage')s.passage='An unrelated source';if(kind==='untrusted-domain')s.url='https://example.com';expect(validateAssertion(assertions.limits,library,now).ok).toBe(false);});
});
describe('deterministic screening',()=>{
 it.each([[1999999,'appears_supported'],[2000000,'appears_supported'],[2000001,'more_information'],[2500000,'more_information'],[3000000,'more_information'],[3000001,'outside_supported']] as const)('screens %i cents as %s', (amount,outcome)=>{const c=sample();c.dateUncertain=false;c.amountCents=amount;expect(screenRoute(c,now).outcome).toBe(outcome);expect(c.amountCents).toBe(amount);});
 it('requires actual bilateral consent',()=>{const c=sample();c.dateUncertain=false;c.amountCents=3000000;c.consent='both_confirmed';expect(screenRoute(c,now).outcome).toBe('appears_supported');c.consent='declined';expect(screenRoute(c,now).outcome).toBe('more_information');});
 it.each(['2024-09-04','2024-09-05','2024-09-06'])('checks calendar boundary %s',date=>{const c=sample();c.dateUncertain=false;c.causeOfActionDate=date;expect(screenRoute(c,now).outcome).toBe(date==='2024-09-04'?'outside_supported':'appears_supported');});
 it.each([null,'bad-date','2026-02-30','2027-01-01'])('does not invent a deadline for %s',date=>{const c=sample();c.dateUncertain=false;c.causeOfActionDate=date;expect(screenRoute(c,now).outcome).toBe('more_information');});
 it('preserves uncertain dates and exceptional circumstances',()=>{const c=sample();expect(screenRoute(c,now).outcome).toBe('more_information');c.dateUncertain=false;c.exceptionalCircumstances='present';expect(screenRoute(c,now).outcome).toBe('more_information');});
 it('refers unsupported categories and overseas respondents',()=>{const c=sample();c.claimType='other';expect(screenRoute(c,now).outcome).toBe('outside_supported');c.claimType='services';c.parties[1].location='overseas';expect(screenRoute(c,now).outcome).toBe('outside_supported');});
});
describe('draft and amount invariants',()=>{
 it('deduplicates repeated contradiction questions in draft warnings',()=>{const c=sample();const duplicate={...c.contradictions[0],id:'duplicate-warning'};const d=assembleDraft(c,[...c.contradictions,duplicate]);expect(new Set(d.warnings).size).toBe(d.warnings.length);});
 it('leaves required details blank and includes the contradiction in the narrative',()=>{const c=sample();const d=assembleDraft(c,c.contradictions);expect(d.fields.find(f=>f.id==='assessment_id')?.value).toBe('');expect(d.gaps).toContain('Respondent address');expect(d.renderedDraft).toContain('not established');expect(d.fields.every(f=>!f.value||isRenderable(f,c))).toBe(true);expect(readyForTransfer(d,c)).toBe(false);});
 it('fails closed when contradiction review is unavailable',()=>{const c=sample();const d=assembleDraft(c,null);d.fields.forEach(f=>f.reviewedAt='2026-09-05');d.gapsAcknowledged=true;expect(readyForTransfer(d,c)).toBe(false);expect(d.warnings.join(' ')).toContain('unavailable');});
 it('withholds missing sources even when text looks plausible',()=>{const c=sample();const d=assembleDraft(c,c.contradictions);d.fields[0].sourceRef=null;expect(isRenderable(d.fields[0],c)).toBe(false);expect(renderDraft(d,c)).toContain('source or information missing');});
 it('calculates refunds using integer cents and excludes disputed components',()=>{const c=sample();c.facts.push({...c.facts.find(f=>f.key==='claim_component_cents')!,id:'refund',key:'refund_cents',value:35000});expect(amountCalculation(c).total).toBe(215000);c.facts.at(-1)!.disputed=true;expect(amountCalculation(c).total).toBeNull();});
 it('allows a sourced excerpt edit and refuses a new allegation',()=>{const c=sample();const f=assembleDraft(c,c.contradictions).fields[0];expect(validateEdit(f,'bathroom waterproofing',{kind:'excerpt',id:'e1'},c)).toBeNull();expect(validateEdit(f,'They deliberately defrauded me',{kind:'excerpt',id:'e1'},c)).not.toBeNull();expect(validateEdit(f,'forge a receipt',f.sourceRef,c)).toContain('cannot');});
 it('does not permit removing unresolved contrary material',()=>{const c=sample();const f=assembleDraft(c,c.contradictions).fields.find(f=>f.id==='uncertainty-ct1')!;expect(validateEdit(f,'',f.sourceRef,c)).toContain('must remain');});
 it('reviewed for transfer requires every populated field and acknowledgement',()=>{const c=sample();const d=assembleDraft(c,c.contradictions);d.fields.filter(f=>f.value).forEach(f=>f.reviewedAt='2026-09-05');expect(readyForTransfer(d,c)).toBe(false);d.gapsAcknowledged=true;expect(readyForTransfer(d,c)).toBe(true);c.version++;expect(readyForTransfer(d,c)).toBe(false);});
});
describe('shared version clock',()=>{
 it('a material correction invalidates route tasks totals and drafts without regenerating them',()=>{const c=sample();const r=screenRoute(c,now);const tasks=createTasks(c);const draft=assembleDraft(c,c.contradictions);const changed={...c,version:c.version+1,amountCents:300000};expect(stale(r,changed)).toBe(true);expect(tasks.every(t=>stale(t,changed))).toBe(true);expect(draft.fields.every(f=>stale(f,changed))).toBe(true);expect(draft.fields.find(f=>f.id==='total')!.value).toBe('S$2,500.00');});
});
