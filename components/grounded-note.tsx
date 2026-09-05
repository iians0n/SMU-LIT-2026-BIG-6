'use client';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { assertions, validateAssertion } from '@/lib/retrieval';
import { useCase } from './case-provider';

export function GroundedNote({assertionId}:{assertionId:string}){const {sources,openSource}=useCase();const assertion=assertions[assertionId];const result=validateAssertion(assertion,sources);if(!result.ok)return <div className="callout"><ShieldCheck size={19}/><span>{result.reason} Check the official source before relying on this instruction.</span></div>;return <div className="callout callout-info"><ShieldCheck size={19}/><div><div>{assertion.text}</div><button className="button button-quiet" style={{padding:0,minHeight:30,color:'var(--green)'}} onClick={()=>openSource(assertion.sourceId)}>Reviewed source <ExternalLink size={14}/></button></div></div>}
