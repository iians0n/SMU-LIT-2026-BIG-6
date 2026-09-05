import JSZip from 'jszip';
import { z } from 'zod';
import { api,requireCase,checkVersion } from '@/lib/server/session';
import { getWorkflow,appendVerification } from '@/lib/workflow';
import { isRenderable,readyForTransfer,renderDraft,sourceValue } from '@/lib/drafting';
import { assertions,sources,validateAssertion } from '@/lib/retrieval';
export async function POST(request:Request){return api(request,async()=>{const c=requireCase(request);const b=z.object({version:z.number().int(),kind:z.enum(['pack','verification','referral']).default('pack')}).parse(await request.json());checkVersion(c,b.version);const w=getWorkflow(c);const zip=new JSZip();const d=w.draft;const old=d.sourceCaseVersion!==c.version;
 appendVerification(c,{action:'exported',description:`Downloaded ${b.kind}; filing status unchanged`,sourceCaseVersion:c.version,sourceRefs:[],aiDrafted:false});
 zip.file('verification-record.json',JSON.stringify(w.verification,null,2));
 if(b.kind!=='verification'){
  const status=old?'NEEDS REVIEW — the case changed':readyForTransfer(d,c)?'REVIEWED FOR TRANSFER — no guarantee of court acceptance':'WORKING DRAFT — review required';
  const safe=d.fields.map(f=>({...f,value:isRenderable(f,c)?f.value:'[WITHHELD: source missing]'}));
  if(b.kind==='pack'){
   zip.file('claim-summary.txt',`${status}\nCase version ${c.version}; draft version ${d.sourceCaseVersion}\n\n${renderDraft(d,c)}\n\n${!d.contradictionsAvailable?'Contradiction review unavailable; do not treat this narrative as complete.':''}`);
   for(const section of ['chronology','evidence','amount','worksheet'] as const)zip.file(`${section}.txt`,`${status}\n\n`+safe.filter(f=>f.section===section).map(f=>`${f.label}: ${f.value||'[MISSING]'}\nSource: ${f.sourceRef?`${f.sourceRef.kind}:${f.sourceRef.id}`:'none'}${f.additionalSourceRefs.map(r=>`, ${r.kind}:${r.id}`).join('')}`).join('\n\n'));
   zip.file('draft-fields.json',JSON.stringify(safe,null,2));
   const instructions=['assessment','filing',...(c.parties.some(p=>p.role==='respondent'&&p.type==='business')?['acra']:[]),...((c.amountCents??0)>2000000?['consent']:[]),'service'].map(id=>{const a=assertions[id];const result=validateAssertion(a);return result.ok?`${a.text}\n${result.source!.url}`:`Instruction withheld: ${result.reason} Check the official source before continuing.`;});
   zip.file('cjts-checklist.txt',instructions.join('\n\n')+'\n\nFiling, payment, service and Declaration of Service take place outside this tool.');
  }
  zip.file('preparation-notes.txt',`${status}\n\nMissing information\n${d.gaps.join('\n')||'None identified'}\n\nUnresolved issues\n${d.warnings.join('\n')||'None identified in the reviewed material'}\n\n${old?'Regenerate and review affected drafts before use.':''}`);
  zip.file('referral-brief.txt',`Case: ${c.title}\nVersion: ${c.version}\n\nConfirmed account\n${c.facts.filter(f=>f.confirmedByUser&&!f.unknown).map(f=>`${f.label}: ${f.value} [fact:${f.id}; ${f.origin}${f.disputed?'; disputed':''}]`).join('\n')}\n\nFiles\n${c.documents.map(d=>d.name).join('\n')}\n\nQuestions for human review\n${c.unresolvedQuestions.join('\n')}\n\n${validateAssertion(assertions.help).ok?assertions.help.text+'\nhttps://www.judiciary.gov.sg/legal-help-support':'Help guidance needs source review; consult the official Courts website.'}`);
  zip.file('source-record.json',JSON.stringify({official:sources,caseSources:d.fields.flatMap(f=>[f.sourceRef,...f.additionalSourceRefs]).filter(r=>r!==null).map(ref=>({ref,value:sourceValue(c,ref)}))},null,2));
 }
 const bytes=await zip.generateAsync({type:'uint8array'});return new Response(bytes as BodyInit,{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="casepath-${b.kind}-v${c.version}.zip"`,'Cache-Control':'no-store'}});});}
