'use client';
import Link from 'next/link';
import { ArrowRight, Layers3 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { Badge, PageHeader } from '@/components/ui';
function Integration(){const params=useSearchParams(),stage=params.get('stage')??'case';const {record}=useCase();if(!record)return null;return <><PageHeader title={stage[0].toUpperCase()+stage.slice(1)} description="This stage reads from the shared case record."/><div style={{maxWidth:800,marginTop:38}}><div className="callout callout-info"><Layers3 size={20}/><span>The shared shell is ready. This screen will be replaced automatically when the corresponding intake component is present.</span></div><section className="section" style={{marginTop:24}}><div className="row"><h3>Current record</h3><Badge label={`Version ${record.version}`} tone="neutral"/></div><p className="muted">{record.facts.filter(f=>f.confirmedByUser).length} confirmed facts · {record.documents.length} documents · {record.issues.length} assessed issues</p>{record.issues.map(issue=><div className="attention" key={issue.id}><span style={{flex:1}}>{issue.title}</span><Badge label={issue.supportStatus.replaceAll('_',' ')} tone={issue.supportStatus==='supported'?'good':issue.supportStatus==='partial_or_disputed'?'warn':'bad'}/></div>)}</section><Link href="/" className="button button-secondary">Back to overview <ArrowRight size={16}/></Link></div></>}
export default function Page(){return <ViewState><Suspense><Integration/></Suspense></ViewState>}
