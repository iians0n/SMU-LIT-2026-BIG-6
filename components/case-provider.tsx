'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Case, Source } from '@/lib/contracts';
import type { Workflow } from '@/lib/workflow';

type ContextValue={record:Case|null;workflow:Workflow|null;sources:Source[];loading:boolean;error:string|null;reload:()=>Promise<void>;mutate:<T>(url:string,body:unknown)=>Promise<T>;openSource:(id:string)=>void;toast:(text:string)=>void};
const CaseContext=createContext<ContextValue|null>(null);

async function json<T>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,{cache:'no-store',...init,headers:{'Content-Type':'application/json',...(init?.headers??{})}});const body=await response.json().catch(()=>({error:'The response could not be read.'}));if(!response.ok)throw new Error(body.error??'The request could not be completed.');return body as T;}

export function CaseProvider({children}:{children:React.ReactNode}){
 const [record,setRecord]=useState<Case|null>(null),[workflow,setWorkflow]=useState<Workflow|null>(null),[sources,setSources]=useState<Source[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[sourceId,setSourceId]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
 const reload=useCallback(async()=>{try{setError(null);await json('/api/session',{method:'POST'});const [c,w,s]=await Promise.all([json<Case>('/api/case'),json<Workflow>('/api/workflow'),json<Source[]>('/api/sources')]);setRecord(c);setWorkflow(w);setSources(s);}catch(e){setError(e instanceof Error?e.message:'Unable to load the case.');}finally{setLoading(false);}},[]);
 useEffect(()=>{const id=window.setTimeout(()=>void reload(),0);return()=>window.clearTimeout(id);},[reload]);
 useEffect(()=>{if(!notice)return;const id=window.setTimeout(()=>setNotice(null),2600);return()=>window.clearTimeout(id);},[notice]);
 const mutate=useCallback(async<T,>(url:string,body:unknown)=>{const result=await json<T>(url,{method:'POST',body:JSON.stringify(body)});await reload();return result;},[reload]);
 const selected=sources.find(s=>s.id===sourceId);
 const value=useMemo(()=>({record,workflow,sources,loading,error,reload,mutate,openSource:setSourceId,toast:setNotice}),[record,workflow,sources,loading,error,reload,mutate]);
 return <CaseContext.Provider value={value}>{children}{sourceId&&<><button className="drawer-scrim" aria-label="Close source" onClick={()=>setSourceId(null)}/><aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="source-title"><div className="drawer-head"><div><div className="eyebrow">Reviewed source</div><h2 id="source-title">{selected?.title??'Source unavailable'}</h2></div><button className="button button-quiet" autoFocus onClick={()=>setSourceId(null)}>Close</button></div>{selected?<div className="stack" style={{marginTop:24}}><p>{selected.passage}</p><div className="small muted">Reviewed {new Date(selected.reviewedAt).toLocaleDateString('en-SG',{dateStyle:'medium'})} · Version {selected.version}</div><a className="button button-secondary" href={selected.url} target="_blank" rel="noreferrer">Open official page</a></div>:<p className="muted">This source could not be loaded.</p>}</aside></>}{notice&&<div className="toast" role="status">{notice}</div>}</CaseContext.Provider>;
}

export function useCase(){const value=useContext(CaseContext);if(!value)throw new Error('useCase must be used inside CaseProvider');return value;}
