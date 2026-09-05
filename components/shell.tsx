'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CircleHelp, ClipboardCheck, FileArchive, FileSearch, FolderOpen, LayoutGrid, Menu, MessagesSquare, Route, Scale, UserRound, X } from 'lucide-react';
import { useState } from 'react';

// The six stages are a sequence, not a menu. Numbering them is the cheapest
// way to say so - without it the sidebar reads as nine equal destinations and
// a first-time user has no idea where to start.
// Six destinations, in the order they happen. The conversation is first
// because it is where the work actually gets done; everything after it is
// review. The separate "Explain" page went away - the assistant does that now,
// and two ways to tell your story is one too many.
const primary=[['/','Talk it through',MessagesSquare,''],['/documents','Your documents',FolderOpen,'1'],['/chronology','Check the facts',UserRound,'2'],['/evidence','What your files show',FileSearch,'3'],['/options','Next steps',Route,'4'],['/prepare','Your pack',FileArchive,'5']] as const;
const secondary=[['/dashboard','Everything at once',LayoutGrid],['/sources','Official sources',BookOpen],['/verification','Verification record',ClipboardCheck]] as const;

function Navigation({close}:{close?:()=>void}){const path=usePathname();return <><div className="side-heading">Your claim</div><nav className="side-nav" aria-label="Case stages">{primary.map(([href,label,Icon,step])=><Link key={href} href={href} onClick={close} className="side-link" aria-current={path===href?'page':undefined}><Icon size={20}/><span>{label}</span>{step&&<span className="side-step" aria-hidden="true">{step}</span>}</Link>)}</nav><div className="side-spacer"/><div className="side-rule"/><div className="side-heading">Reference</div><nav className="side-nav" aria-label="References">{secondary.map(([href,label,Icon])=><Link key={href} href={href} onClick={close} className="side-link" aria-current={path===href?'page':undefined}><Icon size={20}/><span>{label}</span></Link>)}</nav></>}

export function Shell({children}:{children:React.ReactNode}){const [mobile,setMobile]=useState(false);return <div className="app-shell"><aside className="sidebar"><Link href="/" className="brand">Casepath</Link><Navigation/></aside>{mobile&&<><button className="drawer-scrim" aria-label="Close menu" onClick={()=>setMobile(false)}/><aside className="drawer" style={{left:0,right:'auto'}}><div className="drawer-head"><span className="brand" style={{margin:0}}>Casepath</span><button className="button button-quiet" onClick={()=>setMobile(false)} aria-label="Close menu"><X size={20}/></button></div><div style={{height:24}}/><Navigation close={()=>setMobile(false)}/></aside></>}<main className="main-frame"><header className="topbar"><div className="row-start"><button className="button button-quiet mobile-menu" onClick={()=>setMobile(true)} aria-label="Open menu"><Menu size={21}/></button><div className="topbar-title">Small claims preparation</div></div><div className="topbar-actions"><Link className="button button-quiet" href="/sources"><CircleHelp size={19}/><span>Help</span></Link><span aria-hidden="true" style={{height:30,width:1,background:'var(--line)'}}/><span className="button button-quiet"><Scale size={19}/><span>Demo case</span></span></div></header><div className="content">{children}</div></main></div>}
