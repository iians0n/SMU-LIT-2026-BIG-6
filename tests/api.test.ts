import { beforeEach,describe,it,expect,vi } from 'vitest';
import JSZip from 'jszip';
import { POST as session } from '@/app/api/session/route';
import { GET as getCase } from '@/app/api/demo/case/[[...path]]/route';
import { POST as scenario } from '@/app/api/demo/scenario/route';
import { GET as drafts,POST as editDraft } from '@/app/api/drafts/route';
import { POST as exportPack } from '@/app/api/export/route';
import { POST as verification,GET as log } from '@/app/api/verification/route';
import { POST as tasks } from '@/app/api/tasks/route';
import type { Case } from '@/lib/dashboard/contracts';
import { resetCase } from '@/lib/store';
import { demoCase } from '@/fixtures/case.demo';

const url='http://localhost:3000';
function req(path:string,cookie='',body?:unknown){return new Request(url+path,{method:body===undefined?'GET':'POST',headers:{cookie,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function setup(){const response=await session(req('/api/session','',{}));const cookie=response.headers.get('set-cookie')!.split(';')[0];const r=await getCase(req('/api/case',cookie),{params:Promise.resolve({})});return {cookie,c:await r.json() as Case};}

describe('session scoped API and working export',()=>{
 beforeEach(()=>resetCase(demoCase));
 it('requires a session and denies access to another case id including exports',async()=>{expect((await drafts(req('/api/drafts'))).status).toBe(401);const {cookie,c}=await setup();expect((await drafts(req('/api/drafts?caseId=another-case',cookie))).status).toBe(404);expect((await exportPack(req('/api/export?caseId=another-case',cookie,{version:c.version}))).status).toBe(404);});
 it('rejects cross-origin writes',async()=>{const request=new Request(url+'/api/session',{method:'POST',headers:{origin:'https://attacker.example'}});expect((await session(request)).status).toBe(403);});
 it('exports a real zip with separated narrative notes and verification, and supports retry',async()=>{const {c,cookie}=await setup();for(let n=0;n<2;n++){const r=await exportPack(req('/api/export',cookie,{version:c.version,kind:'pack'}));expect(r.status).toBe(200);const zip=await JSZip.loadAsync(await r.arrayBuffer());expect(Object.keys(zip.files)).toContain('claim-summary.txt');expect(Object.keys(zip.files)).toContain('preparation-notes.txt');expect(Object.keys(zip.files)).toContain('verification-record.json');expect(await zip.file('claim-summary.txt')!.async('string')).toContain('not established whether');expect(await zip.file('worksheet.txt')!.async('string')).toContain('[MISSING]');}const record=await getCase(req('/api/case',cookie),{params:Promise.resolve({})});expect((await record.json()).currentStage).toBe(c.currentStage);});
 it('keeps stale drafts until explicit regeneration and rejects stale review writes',async()=>{const {c,cookie}=await setup();await drafts(req('/api/drafts',cookie));await scenario(req('/api/demo/scenario',cookie,{version:c.version,scenario:'changed_amount'}));const d=await (await drafts(req('/api/drafts',cookie))).json();expect(d.sourceCaseVersion).toBe(c.version);expect((await editDraft(req('/api/drafts',cookie,{version:c.version,action:'review',id:'agreement'}))).status).toBe(409);});
 it('fails closed when the real contradiction endpoint cannot be read',async()=>{const {cookie,c}=await setup();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('unavailable')));const r=await editDraft(req('/api/drafts',cookie,{version:c.version,action:'refresh'}));expect((await r.json()).contradictionsAvailable).toBe(false);vi.unstubAllGlobals();});
 it('consumes a live-shaped contradiction response through the frozen endpoint',async()=>{const {cookie,c}=await setup();const spy=vi.fn().mockResolvedValue(Response.json([{...c.contradictions[0],description:'New pipeline finding',resolved:false}]));vi.stubGlobal('fetch',spy);const r=await editDraft(req('/api/drafts',cookie,{version:c.version,action:'refresh'}));expect((await r.json()).renderedDraft).toContain('New pipeline finding');expect(String(spy.mock.calls[0][0])).toContain('/api/case/contradictions');vi.unstubAllGlobals();});
 it('does not preselect a route and enforces task dependencies',async()=>{const {cookie,c}=await setup();const r=await tasks(req('/api/tasks',cookie,{version:c.version,action:'choose',option:'file'}));expect(r.status).toBe(409);expect((await tasks(req('/api/tasks',cookie,{version:c.version,action:'complete',id:'assessment'}))).status).toBe(409);});
 it('appends actor-scoped verification and rejects invented references',async()=>{const {cookie,c}=await setup();expect((await verification(req('/api/verification',cookie,{action:'reviewed',description:'Reviewed fact',sourceCaseVersion:c.version,sourceRefs:[{kind:'fact',id:'fake'}]}))).status).toBe(422);await verification(req('/api/verification',cookie,{action:'reviewed',description:'Reviewed fact',sourceCaseVersion:c.version,sourceRefs:[{kind:'fact',id:c.facts[0].id}]}));const events=await (await log(req('/api/verification',cookie))).json();expect(events.at(-1).caseId).toBe(c.id);expect(events.at(-1).actorId).toBe(c.ownerId);});
});
