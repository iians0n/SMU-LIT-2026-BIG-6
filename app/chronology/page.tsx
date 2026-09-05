'use client';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, FileText, PencilLine, User } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { Badge, Button, PageHeader } from '@/components/ui';
import type { Fact } from '@/lib/dashboard/contracts';
import { ORIGIN_PLAIN } from '@/lib/plain-language';

const ORIGIN = {
  user_stated: { label: ORIGIN_PLAIN.user_stated, Icon: User },
  document_extracted: { label: ORIGIN_PLAIN.document_extracted, Icon: FileText },
  inferred: { label: ORIGIN_PLAIN.inferred, Icon: CircleHelp },
} as const;

/** Origin and confirmation are separate on purpose — see the note below the list. */
function statusBadges(fact: Fact) {
  const out: { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' }[] = [];
  if (fact.confirmedByUser) out.push({ label: 'You said this is right', tone: 'good' });
  if (fact.disputed) out.push({ label: 'Your files disagree about this', tone: 'warn' });
  if (fact.unknown) out.push({ label: 'Not known', tone: 'neutral' });
  if (!fact.confirmedByUser && !fact.disputed && !fact.unknown) {
    out.push({ label: 'Not checked yet', tone: 'neutral' });
  }
  return out;
}

function Entry({ fact, date }: { fact: Fact; date: string | null }) {
  const { mutate, toast, record } = useCase();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fact.label);
  const [busy, setBusy] = useState(false);
  const origin = ORIGIN[fact.origin];

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      await mutate('/api/facts', { factId: fact.id, action, ...extra });
      toast(
        action === 'correct'
          ? 'Corrected. Anything built from this now needs another look.'
          : 'Updated.',
      );
      setEditing(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That change could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="section" style={{ marginBottom: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="small muted">{date ?? 'Date not established'}</div>
          {editing ? (
            <textarea
              className="field"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              aria-label="Correct this entry"
              style={{ width: '100%', marginTop: 6 }}
            />
          ) : (
            <p style={{ margin: '6px 0 0', lineHeight: 1.55 }}>{fact.label}</p>
          )}
          <div className="row-start" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span className="small muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <origin.Icon size={14} /> {origin.label}
            </span>
            {statusBadges(fact).map((b) => (
              <Badge key={b.label} label={b.label} tone={b.tone} />
            ))}
            {fact.sourceLinks.length === 0 && fact.origin === 'user_stated' && (
              <Badge label="No document for this" tone="neutral" />
            )}
          </div>
        </div>
      </div>

      <div className="row-start" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {editing ? (
          <>
            <Button kind="primary" disabled={busy || !draft.trim()} onClick={() => void act('correct', { statement: draft })}>
              Save correction
            </Button>
            <Button kind="quiet" disabled={busy} onClick={() => { setDraft(fact.label); setEditing(false); }}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button disabled={busy || fact.confirmedByUser} onClick={() => void act('confirm')}>
              <CheckCircle2 size={16} /> This is right
            </Button>
            <Button kind="quiet" disabled={busy} onClick={() => setEditing(true)}>
              <PencilLine size={16} /> Correct it
            </Button>
            <Button kind="quiet" disabled={busy || fact.unknown} onClick={() => void act('unknown')}>
              I don&apos;t know
            </Button>
            {fact.disputed && (
              <span className="small muted">
                Left visible because another document says something different. Resolving it is a
                decision for you, not for us.
              </span>
            )}
          </>
        )}
      </div>
      {record && fact.extractionConfidence !== null && fact.extractionConfidence < 0.9 && (
        <div className="callout" style={{ marginTop: 12 }}>
          <AlertTriangle size={18} />
          <span>
            This came from a document we found hard to read. Check it against the original before
            relying on it.
          </span>
        </div>
      )}
    </li>
  );
}

function ChronologyPage() {
  const { record } = useCase();
  if (!record) return null;

  const factById = new Map(record.facts.map((f) => [f.id, f]));
  const dated = record.events
    .map((e) => ({ date: e.date, fact: factById.get(e.id.replace(/^event-/, '')) }))
    .filter((e): e is { date: string | null; fact: Fact } => Boolean(e.fact))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));

  const datedIds = new Set(dated.map((d) => d.fact.id));
  const undated = record.facts.filter((f) => !datedIds.has(f.id) && !f.key.endsWith('_name'));

  const unconfirmed = record.facts.filter((f) => !f.confirmedByUser && !f.unknown).length;
  const disputed = record.facts.filter((f) => f.disputed).length;

  return (
    <>
      <PageHeader
        eyebrow="Stage 3"
        title="Check we understood"
        description="We wrote down what we think happened. If anything is wrong, change it — what you say wins."
        action={<Badge label={disputed > 0 ? 'Needs review' : unconfirmed > 0 ? 'In progress' : 'Reviewed'} tone={disputed > 0 ? 'warn' : 'neutral'} />}
      />

      <div className="split">
        <div>
          {disputed > 0 && (
            <div className="callout" style={{ marginBottom: 18 }}>
              <AlertTriangle size={19} />
              <span>
                {disputed === 1 ? 'One entry conflicts' : `${disputed} entries conflict`} with
                something else in your files. Conflicts stay visible until you decide what happened.
              </span>
            </div>
          )}

          <h2 style={{ marginBottom: 12 }}>Timeline</h2>
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {dated.map(({ fact, date }) => (
              <Entry key={fact.id} fact={fact} date={date} />
            ))}
          </ul>

          {undated.length > 0 && (
            <>
              <h2 style={{ margin: '28px 0 12px' }}>Not tied to a date</h2>
              <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {undated.map((fact) => (
                  <Entry key={fact.id} fact={fact} date={null} />
                ))}
              </ul>
            </>
          )}
        </div>

        <aside className="aside">
          <h3>What confirming does</h3>
          <p className="small muted" style={{ lineHeight: 1.6 }}>
            Confirming records that you stand by an entry. It does <strong>not</strong> make it
            supported by evidence — that depends on what your documents show, and you can see it on
            the Review support page.
          </p>
          <div className="side-rule" style={{ margin: '18px 0' }} />
          <h3>Corrections travel</h3>
          <p className="small muted" style={{ lineHeight: 1.6 }}>
            Changing anything here marks the screening, tasks and draft as needing another look.
            Nothing is silently rewritten on your behalf.
          </p>
          <div className="side-rule" style={{ margin: '18px 0' }} />
          <div className="metric-list">
            <div className="metric"><span>Case version</span><strong>{record.version}</strong></div>
            <div className="metric"><span>Entries</span><strong>{record.facts.length}</strong></div>
            <div className="metric"><span>Awaiting confirmation</span><strong>{unconfirmed}</strong></div>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <ViewState>
      <ChronologyPage />
    </ViewState>
  );
}
