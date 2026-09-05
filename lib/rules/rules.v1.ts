import type { Case, RouteScreening } from '@/lib/dashboard/contracts';
export const RULES_VERSION='sct.goods-services.2026-09-05.v1';
export const RULES={limitCents:2000000,consentLimitCents:3000000,years:2};
export function screenRoute(c:Case,now=new Date()):RouteScreening {
 const reasons:RouteScreening['reasons']=[];
 reasons.push({label:c.claimType==='unknown'?'Confirm the claim category.':['goods','services'].includes(c.claimType)?'Goods or services preparation is supported.':'This category is outside this tool’s supported route; this is not a ruling on SCT jurisdiction.',result:c.claimType==='unknown'?'unknown':['goods','services'].includes(c.claimType)?'pass':'outside',assertionId:'category'});
 const amount=c.amountCents;
 reasons.push({label:amount===null?'Confirm the amount claimed.':amount>RULES.consentLimitCents?'The amount exceeds the supported claim limit.':amount>RULES.limitCents&&c.consent!=='both_confirmed'?'Both parties’ consent has not been confirmed. Further review is needed.':'The amount is within the applicable configured limit.',result:amount===null?'unknown':amount>RULES.consentLimitCents?'outside':amount>RULES.limitCents&&c.consent!=='both_confirmed'?'unknown':'pass',assertionId:'limits'});
 const date=c.causeOfActionDate;const parsed=date?new Date(date+'T00:00:00Z'):null;
 const valid=!!parsed&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;
 if(c.dateUncertain||!valid||parsed!>now) reasons.push({label:'The relevant event date is uncertain. No filing deadline has been assigned.',result:'unknown',assertionId:'time'});
 else {const end=new Date(parsed!);end.setUTCFullYear(end.getUTCFullYear()+2);const today=now.toISOString().slice(0,10);const expired=today>end.toISOString().slice(0,10);reasons.push({label:expired?'The confirmed event date is outside the configured two-year window.':'The confirmed event date is within the configured two-year window.',result:expired?'outside':'pass',assertionId:'time'});}
 const respondent=c.parties.find(p=>p.role==='respondent');
 reasons.push({label:respondent?.location==='singapore'?'The respondent is recorded as located in Singapore.':respondent?.location==='overseas'?'The respondent is recorded as overseas. Obtain appropriate help.':'Confirm where the respondent is located.',result:respondent?.location==='singapore'?'pass':respondent?.location==='overseas'?'outside':'unknown',assertionId:'location'});
 if(c.exceptionalCircumstances!=='none') reasons.push({label:'Exceptional circumstances need human review.',result:'unknown',assertionId:'exceptions'});
 return {sourceCaseVersion:c.version,rulesVersion:RULES_VERSION,assessedAt:now.toISOString(),outcome:reasons.some(r=>r.result==='outside')?'outside_supported':reasons.some(r=>r.result==='unknown')?'more_information':'appears_supported',reasons,reviewed:false};
}
