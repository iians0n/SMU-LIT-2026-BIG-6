'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Case, Source } from '@/lib/dashboard/contracts';
import type { CaseRecord } from '@/lib/contracts';
import type { Workflow } from '@/lib/workflow';
import { adaptCaseRecord } from '@/lib/dashboard/adapt-case';

type ContextValue = {
  record: Case | null;
  workflow: Workflow | null;
  sources: Source[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  mutate: <T>(url: string, body: unknown) => Promise<T>;
  openSource: (id: string) => void;
  toast: (text: string) => void;
};

const CaseContext = createContext<ContextValue | null>(null);

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({ error: 'The response could not be read.' }));
  if (!response.ok) throw new Error(body.error ?? 'The request could not be completed.');
  return body as T;
}

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [record, setRecord] = useState<Case | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const closeSource = useRef<HTMLButtonElement>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      await json('/api/session', { method: 'POST' });
      const [raw, nextWorkflow, nextSources] = await Promise.all([
        json<CaseRecord>('/api/case'),
        json<Workflow>('/api/workflow'),
        json<Source[]>('/api/sources'),
      ]);
      setRecord(adaptCaseRecord(raw));
      setWorkflow(nextWorkflow);
      setSources(nextSources);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load the case.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(id);
  }, [reload]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!sourceId) return;
    const app = document.querySelector<HTMLElement>('.app-shell');
    if (app) app.inert = true;
    closeSource.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSourceId(null);
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
      if (app) app.inert = false;
    };
  }, [sourceId]);

  const mutate = useCallback(async <T,>(url: string, body: unknown) => {
    const result = await json<T>(url, { method: 'POST', body: JSON.stringify(body) });
    await reload();
    return result;
  }, [reload]);

  const selected = sources.find((source) => source.id === sourceId);
  const value = useMemo(() => ({
    record,
    workflow,
    sources,
    loading,
    error,
    reload,
    mutate,
    openSource: setSourceId,
    toast: setNotice,
  }), [record, workflow, sources, loading, error, reload, mutate]);

  return (
    <CaseContext.Provider value={value}>
      {children}
      {sourceId && (
        <>
          <button className="drawer-scrim" tabIndex={-1} aria-hidden="true" onClick={() => setSourceId(null)} />
          <aside className="drawer source-drawer" role="dialog" aria-modal="true" aria-labelledby="source-title">
            <div className="drawer-head">
              <div>
                <h2 id="source-title">{selected?.title ?? 'Source unavailable'}</h2>
                <div className="source-meta">Reviewed source</div>
              </div>
              <button ref={closeSource} className="button button-quiet" onClick={() => setSourceId(null)}>Close</button>
            </div>
            {selected ? (
              <div className="stack source-content">
                <p>{selected.passage}</p>
                <div className="small muted">
                  Reviewed {new Date(selected.reviewedAt).toLocaleDateString('en-SG', { dateStyle: 'medium' })} · Version {selected.version}
                </div>
                <a className="button button-secondary" href={selected.url} target="_blank" rel="noreferrer">Open official page</a>
              </div>
            ) : <p className="muted">This source could not be loaded.</p>}
          </aside>
        </>
      )}
      {notice && <div className="toast" role="status" aria-atomic="true">{notice}</div>}
    </CaseContext.Provider>
  );
}

export function useCase() {
  const value = useContext(CaseContext);
  if (!value) throw new Error('useCase must be used inside CaseProvider');
  return value;
}
