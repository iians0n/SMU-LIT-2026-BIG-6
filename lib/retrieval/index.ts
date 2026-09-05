import data from '@/fixtures/sources/official.json';
import type { Source, GroundedAssertion } from '@/lib/dashboard/contracts';
export const sources:Source[]=data;
// Curated paraphrases, checked against the linked official pages. These are not quotations.
export const assertions:Record<string,GroundedAssertion> = {
  limits:{id:'limits',text:'The usual limit is S$20,000. Above this, up to S$30,000 requires consent from both parties.',sourceId:'S2',passage:'The claim limit is S$20,000, or S$30,000 with a Memorandum of Consent from both parties.'},
  time:{id:'time',text:'The filing period is two years from the event creating the cause of action. An uncertain event date needs review.',sourceId:'S2',passage:'Claims must be filed within two years of the event creating the cause of action.'},
  category:{id:'category',text:'Goods and services contracts are among the categories that SCT can hear.',sourceId:'S2',passage:'Goods and services contracts are among the eligible categories.'},
  location:{id:'location',text:'The claim must be served on a respondent in Singapore.',sourceId:'S2',passage:'Claims must be served on a respondent in Singapore.'},
  exceptions:{id:'exceptions',text:'Bankruptcy or insolvency can require additional permission. Obtain appropriate help.',sourceId:'S2',passage:'Bankruptcy or insolvency may require permission.'},
  assessment:{id:'assessment',text:'Complete the official CJTS pre-filing assessment. It is not a conclusive jurisdiction decision.',sourceId:'S2',passage:'The CJTS pre-filing assessment is not conclusive.'},
  filing:{id:'filing',text:'Prepare your assessment ID, parties’ details, claim summary and supporting PDFs for CJTS.',sourceId:'S3',passage:'File through CJTS using the pre-filing assessment ID, parties\' details, claim summary and supporting PDFs.'},
  acra:{id:'acra',text:'For a business respondent, prepare an ACRA profile obtained within one month of filing.',sourceId:'S3',passage:'For a business respondent, prepare an ACRA profile obtained within one month of filing.'},
  consent:{id:'consent',text:'For a claim above S$20,000 up to S$30,000, prepare the Memorandum of Consent.',sourceId:'S3',passage:'A Memorandum of Consent is required for claims above S$20,000 up to S$30,000.'},
  service:{id:'service',text:'Filing, serving the claim, and filing a Declaration of Service are separate later steps.',sourceId:'S3',passage:'Filing, service of the claim and filing the Declaration of Service are separate steps.'},
  settlement:{id:'settlement',text:'Parties may choose eNegotiation or eMediation in CJTS to resolve the dispute online.',sourceId:'S4',passage:'Parties may choose eNegotiation or eMediation to resolve the dispute online.'},
  responsibility:{id:'responsibility',text:'Review AI-assisted content and its sources. You remain responsible for your court documents.',sourceId:'S6',passage:'Court users are responsible for their court documents. Verify AI-assisted content and references against reliable sources.'},
  help:{id:'help',text:'Use the Courts’ Legal Help Finder to explore assistance. Access is subject to the relevant scheme.',sourceId:'HELP',passage:'The Singapore Courts provide a Legal Help Finder and information on seeking help for civil and tribunal matters. Assistance depends on the relevant scheme and circumstances.'},
};
export function sourceProblem(source:Source|undefined,now=new Date()):string|null {
 if(!source||!source.available||!source.passage.trim()) return 'The supporting source is unavailable.';
 const reviewed=Date.parse(source.reviewedAt);const retrieved=Date.parse(source.retrievedAt);
 if(!Number.isFinite(reviewed)||!Number.isFinite(retrieved)||reviewed>now.getTime()+86400000||now.getTime()-reviewed>30*86400000) return 'This source needs a fresh review.';
 if(!source.url.startsWith('https://www.judiciary.gov.sg/')) return 'The source is outside the approved library.';
 return null;
}
export function validateAssertion(candidate:GroundedAssertion|undefined,library=sources,now=new Date()):{ok:boolean;reason:string;source?:Source} {
 const approved=candidate&&assertions[candidate.id];
 if(!candidate||!approved||candidate.text!==approved.text||candidate.passage!==approved.passage||candidate.sourceId!==approved.sourceId) return {ok:false,reason:'This statement has no reviewed supporting passage.'};
 const source=library.find(s=>s.id===candidate.sourceId);const problem=sourceProblem(source,now);
 if(problem) return {ok:false,reason:problem,source};
 if(!source!.passage.includes(candidate.passage)) return {ok:false,reason:'The passage does not support this statement.',source};
 return {ok:true,reason:'',source};
}
