'use client';
import { useCase } from './case-provider';
import { ErrorState } from './ui';
export function ViewState({children}:{children:React.ReactNode}){const {loading,error,reload}=useCase();if(loading)return <div className="loading" role="status">Preparing your workspace…</div>;if(error)return <ErrorState message={error} onRetry={()=>void reload()}/>;return <>{children}</>}
