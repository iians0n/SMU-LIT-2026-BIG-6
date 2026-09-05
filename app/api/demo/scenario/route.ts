import { z } from 'zod';
import { api,requireCase,checkVersion } from '@/lib/server/session';
import { patchCase,bumpVersion } from '@/lib/store';
import { appendVerification,synchroniseDerivedCase } from '@/lib/workflow';

const schema=z.object({scenario:z.enum(['unsupported','changed_amount','uncertain','supported']),version:z.number().int()});
export async function POST(request:Request){return api(request,async()=>{
 const current=requireCase(request),body=schema.parse(await request.json());checkVersion(current,body.version);
 patchCase(record=>{
  if(body.scenario==='unsupported')record.case.claimCategory='other';
  if(body.scenario==='changed_amount'){
   const outcome=record.facts.find(f=>f.kind==='desired_outcome'&&f.amount);if(outcome?.amount)outcome.amount={currencyCode:'SGD',minorUnits:275000};
  }
  if(body.scenario==='uncertain'){
   const deadline=record.facts.find(f=>f.kind==='promised_performance'&&f.date);if(deadline?.date)deadline.date={...deadline.date,precision:'approximate'};
  }
  if(body.scenario==='supported'){
   record.case.claimCategory='services';record.contradictions=[];
   const deadline=record.facts.find(f=>f.kind==='promised_performance'&&f.date);if(deadline?.date){deadline.date={value:'2026-07-29',precision:'exact'};deadline.disputed=false;}
  }
 });
 bumpVersion(`synthetic demo scenario: ${body.scenario}`);
 synchroniseDerivedCase();
 const next=requireCase(request);appendVerification(next,{action:'case_updated',description:`Synthetic demo scenario: ${body.scenario}`,sourceCaseVersion:next.version,sourceRefs:[],aiDrafted:false});return next;
});}
