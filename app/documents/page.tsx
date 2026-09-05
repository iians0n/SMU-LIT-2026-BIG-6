'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileWarning, Lock, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { Badge, Button, PageHeader } from '@/components/ui';
import type { Document, DocumentIssue } from '@/lib/contracts';
import { DOCUMENT_ISSUE_LABEL, SUPPORTED_EXTENSIONS, UPLOAD_LIMITS } from '@/lib/contracts';

/** What each flag means for the user, and what they can do about it. */
const ISSUE_ADVICE: Record<DocumentIssue, string> = {
  unreadable: 'We could not read any of it. If you have another copy, upload that.',
  password_protected: 'Remove the password and upload it again.',
  truncated: `We read the first ${UPLOAD_LIMITS.maxPagesPerCase} pages. The rest was not read.`,
  unsupported_type: 'We did not read this file. Save it as PDF, DOCX, JPG, PNG or TXT.',
  possibly_unrelated: 'This may not relate to your dispute. Keep it or remove it — your call.',
  low_quality_scan: 'The text was hard to make out, so anything read from it may be wrong. Check it against the original.',
  duplicate: 'You already uploaded this file. A second copy does not add support.',
  over_size_limit: `Files must be under ${UPLOAD_LIMITS.maxBytesPerFile / (1024 * 1024)} MB.`,
};

const tone = (d: Document) =>
  d.processingStatus === 'failed' ? 'bad' : d.issues.length > 0 ? 'warn' : 'good';

interface UploadReport {
  fileName: string;
  status: string;
  issues: DocumentIssue[];
  failureReason: string | null;
  excerpts: number;
  injectionFindings: { why: string; match: string }[];
}

function DocumentsPage() {
  const { reload, toast } = useCase();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [reports, setReports] = useState<UploadReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/documents', { cache: 'no-store' });
    if (res.ok) setDocuments((await res.json()).documents);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const run = refresh;
      if (!cancelled) await run();
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    try {
      const form = new FormData();
      for (const f of list) form.append('files', f);
      const res = await fetch('/api/documents', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'The upload could not be completed.');
      setReports(body.results);
      if (body.skipped) toast(body.skipped);
      await Promise.all([refresh(), reload()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The upload could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(doc: Document) {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(doc.id)}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast(
        body.factsNeedingConfirmation > 0
          ? `Removed. ${body.factsNeedingConfirmation} entry(s) that relied on it need confirming again.`
          : 'Removed.',
      );
      await Promise.all([refresh(), reload()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That file could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  const flagged = documents.filter((d) => d.processingStatus === 'failed' || d.issues.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="Stage 2"
        title="Add your documents"
        description="Upload them in any order. You do not need to sort them or work out which ones matter."
        action={<Badge label={`${documents.length} of ${UPLOAD_LIMITS.maxFilesPerCase}`} tone="neutral" />}
      />

      <div className="split">
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}
            className="empty"
            style={{ borderStyle: 'dashed', borderWidth: 2, background: dragging ? 'var(--surface-2, rgba(0,0,0,0.03))' : undefined }}
          >
            <Upload size={26} />
            <strong>Drop files here</strong>
            <p className="small muted">
              {SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(', ')} · up to{' '}
              {UPLOAD_LIMITS.maxBytesPerFile / (1024 * 1024)} MB each
            </p>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              accept={SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
              onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }}
            />
            <Button kind="primary" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Reading…' : 'Choose files'}
            </Button>
          </div>

          {reports.some((r) => r.injectionFindings.length > 0) && (
            <div className="callout" style={{ marginTop: 18 }}>
              <FileWarning size={19} />
              <span>
                One of these files contains text written to instruct an AI system. We have not acted
                on it and it has not changed anything — but you should know it is there, because it
                suggests the document may not be what it appears to be.
              </span>
            </div>
          )}

          <h2 style={{ margin: '26px 0 12px' }}>Your files</h2>
          {documents.length === 0 ? (
            <p className="muted">Nothing uploaded yet.</p>
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {documents.map((doc) => (
                <li className="section" key={doc.id} style={{ marginBottom: 12 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div className="row-start" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <strong>{doc.userLabel ?? doc.fileName}</strong>
                        <Badge
                          label={
                            doc.processingStatus === 'failed'
                              ? 'Not read'
                              : doc.processingStatus === 'extracted'
                                ? 'Read'
                                : 'Reading…'
                          }
                          tone={tone(doc)}
                        />
                        {doc.issues.map((i) => (
                          <Badge key={i} label={DOCUMENT_ISSUE_LABEL[i]} tone="warn" />
                        ))}
                      </div>
                      <div className="small muted" style={{ marginTop: 6 }}>
                        {doc.fileName} · {(doc.byteSize / 1024).toFixed(0)} KB
                        {doc.pageCount !== null && ` · ${doc.pageCount} page(s)`}
                      </div>
                      {doc.failureReason && (
                        <p className="small" style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
                          {doc.failureReason}
                        </p>
                      )}
                      {doc.issues.map((i) => (
                        <p key={i} className="small muted" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                          {ISSUE_ADVICE[i]}
                        </p>
                      ))}
                    </div>
                    <div className="row-start" style={{ gap: 8 }}>
                      {doc.processingStatus === 'failed' && (
                        <Button kind="quiet" disabled={busy} onClick={() => input.current?.click()}>
                          <RefreshCw size={15} /> Replace
                        </Button>
                      )}
                      <Button kind="quiet" disabled={busy} onClick={() => void remove(doc)}>
                        <Trash2 size={15} /> Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="aside">
          <h3>What we do with them</h3>
          <p className="small muted" style={{ lineHeight: 1.6 }}>
            Originals are kept as you sent them. We read the text, note which page each passage came
            from, and link it to the points it speaks to.
          </p>
          <div className="side-rule" style={{ margin: '18px 0' }} />
          <h3>Files needing attention</h3>
          {flagged.length === 0 ? (
            <p className="small muted">None.</p>
          ) : (
            <ul className="stack" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {flagged.map((d) => (
                <li key={d.id} className="small" style={{ lineHeight: 1.5 }}>
                  {d.fileName}
                  {d.issues.includes('password_protected') && <Lock size={12} style={{ marginLeft: 5 }} />}
                </li>
              ))}
            </ul>
          )}
          <div className="side-rule" style={{ margin: '18px 0' }} />
          <div className="callout">
            <AlertTriangle size={18} />
            <span className="small">
              Removing a file marks anything that relied on it for review. Nothing is quietly
              rewritten.
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <ViewState>
      <DocumentsPage />
    </ViewState>
  );
}
