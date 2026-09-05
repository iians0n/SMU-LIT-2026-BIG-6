import type { ReactNode } from 'react';

export function Badge({label,tone='neutral'}:{label:string;tone?:'neutral'|'good'|'warn'|'bad'}) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function PageHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description:string;action?:ReactNode}) {
  return <header className="row" style={{alignItems:'flex-end'}}><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p className="lede">{description}</p></div>{action}</header>;
}

export function Button({children,kind='secondary',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{kind?:'primary'|'secondary'|'quiet'}) {
  return <button className={`button button-${kind}`} {...props}>{children}</button>;
}

export function ErrorState({message,onRetry}:{message:string;onRetry?:()=>void}) {
  return <div className="empty" role="alert"><strong>Something needs attention</strong><p>{message}</p>{onRetry&&<Button onClick={onRetry}>Try again</Button>}</div>;
}
