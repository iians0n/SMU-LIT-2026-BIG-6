import { randomUUID } from 'node:crypto';
import fixture from '@/fixtures/case.demo.json';
import { CaseSchema, type Case } from '@/lib/contracts';
export class CaseStore {
  private records = new Map<string,Case>();
  getCase(ownerId:string):Case {
    if (!this.records.has(ownerId)) this.records.set(ownerId,CaseSchema.parse({...structuredClone(fixture),ownerId,id:`CP-${randomUUID().slice(0,8)}`}));
    return structuredClone(this.records.get(ownerId)!);
  }
  patchCase(ownerId:string,patch:Partial<Omit<Case,'id'|'ownerId'|'version'>>,expectedVersion?:number):Case {
    const current=this.getCase(ownerId);
    if(expectedVersion!==undefined && expectedVersion!==current.version) throw new Error('The case changed. Reload and review the latest version.');
    const next=CaseSchema.parse({...current,...patch,id:current.id,ownerId,version:current.version});
    if(JSON.stringify(next)!==JSON.stringify(current)) next.version++;
    this.records.set(ownerId,next); return structuredClone(next);
  }
  bumpVersion(ownerId:string):Case {const c=this.getCase(ownerId);c.version++;this.records.set(ownerId,c);return structuredClone(c);}
}
const globalStore=globalThis as unknown as {casepathCases?:CaseStore};
export const caseStore=globalStore.casepathCases ??= new CaseStore();
