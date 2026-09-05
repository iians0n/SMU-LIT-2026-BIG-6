'use client';
import { Clock3, FileCheck2 } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { Badge, PageHeader } from '@/components/ui';
function Verification(){const {workflow}=useCase();if(!workflow)return null;const events=[...workflow.verification].reverse();return <><PageHeader title="Verification record" description="A history of generation, edits, review and exports."/><div style={{maxWidth:860,marginTop:38}}>{events.length===0?<div className="empty"><FileCheck2 size={27} style={{margin:'0 auto 10px'}}/><strong>No review activity yet</strong><p>Actions will appear here as you review the route, tasks and draft.</p></div>:events.map(event=><div className="attention" key={event.id} style={{minHeight:78}}><Clock3 size={19}/><div style={{flex:1}}><strong>{event.description}</strong><div className="small muted">{new Date(event.timestamp).toLocaleString('en-SG')} · case version {event.sourceCaseVersion}</div></div><Badge label={event.aiDrafted?'AI assisted':event.action.replaceAll('_',' ')} tone="neutral"/></div>)}</div></>}
export default function Page(){return <ViewState><Verification/></ViewState>}
