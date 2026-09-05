'use client';
import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { Badge, PageHeader } from '@/components/ui';
import type { Case, Excerpt, IssueAssessment } from '@/lib/dashboard/contracts';

/**
 * Label first, colour second. PRD §3 requires every badge to carry a text label
 * and treats colour as supplementary, so the page has to read correctly in
 * greyscale and to a screen reader.
 */
const STATUS = {
  supported: {
    label: 'Supported',
    tone: 'good',
    meaning:
      'Material we found points directly at this. That is not a finding that it is true, or that it is legally enough.',
  },
  partial_or_disputed: {
    label: 'Partial or disputed',
    tone: 'warn',
    meaning: 'Support is incomplete, indirect, or contradicted by something else in your files.',
  },
  missing: {
    label: 'Support missing',
    tone: 'bad',
    meaning:
      'We found nothing in your files supporting this. That does not mean it did not happen — it means nothing here shows it.',
  },
  not_assessed: {
    label: 'Not assessed',
    tone: 'neutral',
    meaning: 'We could not assess this, so nothing should be read into the absence of a result.',
  },
} as const;

function excerptsById(record: Case): Map<string, Excerpt & { documentName: string }> {
  const map = new Map<string, Excerpt & { documentName: string }>();
  for (const doc of record.documents) {
    for (const e of doc.excerpts) map.set(e.id, { ...e, documentName: doc.name });
  }
  return map;
}

function Quote({ id, lookup, tone }: { id: string; lookup: ReturnType<typeof excerptsById>; tone: 'support' | 'conflict' }) {
  const excerpt = lookup.get(id);
  if (!excerpt) {
    // Never render a citation we cannot resolve — a link that opens nothing is
    // worse than saying the material is unavailable.
    return <li className="small muted">A cited passage is no longer available.</li>;
  }
  return (
    <li style={{ marginBottom: 10 }}>
      <blockquote
        style={{
          margin: 0,
          padding: '10px 13px',
          borderLeft: `3px solid ${tone === 'conflict' ? 'var(--warn, #b8860b)' : 'var(--line)'}`,
          background: 'var(--surface-2, rgba(0,0,0,0.02))',
          borderRadius: 6,
        }}
      >
        <p style={{ margin: 0, lineHeight: 1.5 }}>{excerpt.text}</p>
        <div className="small muted" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <FileText size={13} /> {excerpt.documentName} · page {excerpt.page}
        </div>
      </blockquote>
    </li>
  );
}

function Row({ issue, record }: { issue: IssueAssessment; record: Case }) {
  const [open, setOpen] = useState(issue.supportStatus !== 'supported');
  const lookup = excerptsById(record);
  const status = STATUS[issue.supportStatus];
  const facts = record.facts.filter((f) => issue.factIds.includes(f.id));

  return (
    <section className="section" style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="row"
        style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        <div className="row-start" style={{ gap: 10 }}>
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{issue.title}</h2>
        </div>
        <Badge label={status.label} tone={status.tone} />
      </button>

      <p className="muted" style={{ margin: '12px 0 0', lineHeight: 1.55 }}>{issue.reason}</p>

      {open && (
        <div className="stack" style={{ marginTop: 18 }}>
          <p className="small muted" style={{ margin: 0 }}>{status.meaning}</p>

          {facts.length > 0 && (
            <div>
              <h3 className="eyebrow">What this rests on</h3>
              <ul className="stack" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {facts.map((f) => (
                  <li key={f.id} style={{ lineHeight: 1.5 }}>
                    {f.label}{' '}
                    {f.origin === 'user_stated' && f.sourceLinks.length === 0 && (
                      <span className="small muted">(your account, no document)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="eyebrow">Supporting material</h3>
            {issue.supportingExcerptIds.length === 0 ? (
              <p className="small muted" style={{ margin: '6px 0 0' }}>
                None found in your files.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {issue.supportingExcerptIds.map((id) => (
                  <Quote key={id} id={id} lookup={lookup} tone="support" />
                ))}
              </ul>
            )}
          </div>

          {issue.conflictingExcerptIds.length > 0 && (
            <div>
              <h3 className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} /> Material that points the other way
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {issue.conflictingExcerptIds.map((id) => (
                  <Quote key={id} id={id} lookup={lookup} tone="conflict" />
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="eyebrow">What the other side might say</h3>
            <p className="small muted" style={{ margin: '6px 0 0', lineHeight: 1.55 }}>
              {issue.contraryExplanation}
            </p>
          </div>

          {issue.nextQuestion && (
            <div className="callout callout-info">
              <span><strong>Next useful question.</strong> {issue.nextQuestion}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function EvidencePage() {
  const { record } = useCase();
  if (!record) return null;

  const counts = record.issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.supportStatus] = (acc[i.supportStatus] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="Stage 4"
        title="Review what your evidence shows"
        description="Each point below is checked against your files, one at a time."
      />

      <div className="callout" style={{ marginBottom: 20 }}>
        <AlertTriangle size={19} />
        <span>
          These describe how well each point is supported by your documents. They are not a score,
          a strength rating, or a prediction of what a tribunal would decide.
        </span>
      </div>

      <div className="split">
        <div>
          {record.issues.map((issue) => (
            <Row key={issue.id} issue={issue} record={record} />
          ))}
        </div>

        <aside className="aside">
          <h3>Where you stand</h3>
          <div className="metric-list" style={{ marginTop: 10 }}>
            {(['supported', 'partial_or_disputed', 'missing', 'not_assessed'] as const).map((k) => (
              <div className="metric" key={k}>
                <span>{STATUS[k].label}</span>
                <strong>{counts[k] ?? 0}</strong>
              </div>
            ))}
          </div>
          <div className="side-rule" style={{ margin: '18px 0' }} />
          <h3>Checklist</h3>
          <p className="small muted" style={{ lineHeight: 1.6 }}>
            {record.issues[0]?.checklistVersion ?? 'unversioned'} — a working draft prepared by the
            product team. It has not been reviewed by a qualified lawyer and does not set out the
            legal elements of a claim.
          </p>
          <div className="side-rule" style={{ margin: '18px 0' }} />
          <h3>Adding the same file twice</h3>
          <p className="small muted" style={{ lineHeight: 1.6 }}>
            A duplicate does not improve support. Copies are detected and counted once.
          </p>
        </aside>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <ViewState>
      <EvidencePage />
    </ViewState>
  );
}
