'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Download, FileCheck2, RefreshCw } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { GroundedNote } from '@/components/grounded-note';
import { ViewState } from '@/components/view-state';
import { Badge, Button, PageHeader } from '@/components/ui';
import type { DraftField } from '@/lib/dashboard/contracts';

const sections: { id: DraftField['section']; title: string; description: string }[] = [
  { id: 'summary', title: 'What happened', description: 'Your claim in a few sentences.' },
  { id: 'chronology', title: 'Important dates', description: 'Events in date order.' },
  { id: 'evidence', title: 'Your evidence', description: 'Files connected to your claim.' },
  { id: 'amount', title: 'Amount claimed', description: 'The amount calculated from your confirmed details.' },
  { id: 'worksheet', title: 'CJTS details', description: 'Information to copy into the CJTS website.' },
];

function DraftRow({ field, version }: { field: DraftField; version: number }) {
  const { mutate, toast } = useCase();
  const [value, setValue] = useState(field.value);
  const stale = field.sourceCaseVersion !== version;

  async function save() {
    try {
      await mutate('/api/drafts', {
        version,
        action: 'edit',
        id: field.id,
        value,
        sourceRef: field.sourceRef,
      });
      toast('Saved.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to save this change.');
      setValue(field.value);
    }
  }

  async function review() {
    try {
      await mutate('/api/drafts', { version, action: 'review', id: field.id });
      toast('Marked as checked.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to mark this as checked.');
    }
  }

  return (
    <div className="field">
      <div className="row">
        <label htmlFor={`field-${field.id}`}>
          <strong>{field.label}</strong>
          {field.required && <span className="small muted"> · needed</span>}
        </label>
        <Badge
          label={stale ? 'Check again' : field.reviewedAt ? 'Checked' : field.value ? 'Ready to check' : 'Missing'}
          tone={stale ? 'warn' : field.reviewedAt ? 'good' : 'neutral'}
        />
      </div>

      {field.section === 'amount' ? (
        <div className="draft-amount">{field.value || 'Not entered'}</div>
      ) : (
        <textarea
          id={`field-${field.id}`}
          name={`draft-${field.id}`}
          autoComplete="off"
          rows={field.section === 'summary' ? 3 : 2}
          value={value}
          disabled={stale || field.id.startsWith('uncertainty-')}
          placeholder="Not entered yet"
          onChange={(event) => setValue(event.target.value)}
        />
      )}

      <div className="field-actions">
        <details className="field-source">
          <summary>Source</summary>
          <span>{field.sourceRef ? `${field.sourceRef.kind} · ${field.sourceRef.id}` : 'No source linked'}</span>
        </details>
        <div className="row" style={{ gap: 8 }}>
          {field.section !== 'amount' && value !== field.value && (
            <Button kind="quiet" onClick={() => void save()}>Save</Button>
          )}
          <Button kind="quiet" disabled={!field.value || stale || Boolean(field.reviewedAt)} onClick={() => void review()}>
            {field.reviewedAt ? <><Check size={15} /> Checked</> : 'Mark checked'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Prepare() {
  const { record, workflow, mutate, toast } = useCase();
  if (!record || !workflow) return null;

  // Narrowing from the guard above does not survive into async handlers.
  const current = record;
  const draft = workflow.draft;
  const stale = draft.sourceCaseVersion !== current.version;
  const reviewed = draft.fields.filter(
    (field) => field.value && field.reviewedAt && field.sourceCaseVersion === current.version,
  ).length;
  const populated = draft.fields.filter((field) => field.value).length;
  const ready =
    !stale &&
    draft.contradictionsAvailable &&
    populated === reviewed &&
    draft.gapsAcknowledged &&
    !draft.warnings.some((warning) => warning.includes('differs from'));

  async function refresh() {
    try {
      await mutate('/api/drafts', { version: current.version, action: 'refresh' });
      toast('Updated from your latest details.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to update your PDF details.');
    }
  }

  async function acknowledge(checked: boolean) {
    try {
      await mutate('/api/drafts', {
        version: current.version,
        action: 'acknowledge',
        acknowledged: checked,
      });
      toast(checked ? 'Missing details acknowledged.' : 'Acknowledgement removed.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to update this acknowledgement.');
    }
  }

  async function download(kind: 'pack' | 'verification' | 'referral') {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: current.version, kind }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? `casepath-${kind}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
      await mutate('/api/session', {}).catch(() => undefined);
      toast('PDF downloaded. Nothing was filed or sent.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to download the PDF.');
    }
  }

  return (
    <>
      <PageHeader
        title="Review and download"
        description="Check your information, then download one PDF containing everything you entered."
        action={<Badge label={stale ? 'Update needed' : ready ? 'Checked' : 'In progress'} tone={stale ? 'warn' : ready ? 'good' : 'neutral'} />}
      />

      <div className="split prepare-layout">
        <div>
          {stale && (
            <div className="callout" style={{ marginBottom: 18 }}>
              <AlertTriangle size={20} />
              <div>
                <strong>Your details changed.</strong>
                <div>Update this page before checking or downloading.</div>
                <Button kind="quiet" onClick={() => void refresh()}><RefreshCw size={15} /> Update now</Button>
              </div>
            </div>
          )}

          <div className="review-sections">
            {sections.map((section) => {
              const fields = draft.fields.filter((field) => field.section === section.id);
              const checked = fields.filter(
                (field) => field.value && field.reviewedAt && field.sourceCaseVersion === current.version,
              ).length;
              const withValues = fields.filter((field) => field.value).length;
              return (
                <details className="review-section" key={section.id}>
                  <summary>
                    <span>
                      <strong>{section.title}</strong>
                      <small>{section.description}</small>
                    </span>
                    <span>{withValues ? `${checked}/${withValues} checked` : 'Not ready'}</span>
                  </summary>
                  <div className="review-fields">
                    {fields.map((field) => <DraftRow key={field.id} field={field} version={current.version} />)}
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        <aside className="aside prepare-aside">
          <section className="download-card">
            <h2>Your PDF</h2>
            <p>Includes your answers, claim details, documents, evidence review and next steps.</p>
            <Button kind="primary" onClick={() => void download('pack')}>
              <Download size={17} /> Download preparation PDF
            </Button>
            <p className="download-note">This does not file or send your claim.</p>

            <details className="other-downloads">
              <summary>Other PDF options</summary>
              <div className="stack">
                <Button onClick={() => void download('verification')}>
                  <FileCheck2 size={17} /> Verification history
                </Button>
                <Button onClick={() => void download('referral')}>Brief for getting help</Button>
              </div>
            </details>
          </section>

          <section className="section review-status">
            <h3>Before downloading</h3>
            <p className="small muted">
              {populated ? `${reviewed} of ${populated} completed items checked.` : 'No details to check yet.'}
            </p>

            {(draft.warnings.length > 0 || draft.gaps.length > 0) && (
              <details className="remaining-details">
                <summary>Missing details and warnings</summary>
                {draft.warnings.map((warning, index) => (
                  <div className="callout" key={`${index}-${warning}`}><AlertTriangle size={17} /><span>{warning}</span></div>
                ))}
                {draft.gaps.length > 0 && <ul className="small muted">{draft.gaps.map((gap, index) => <li key={`${index}-${gap}`}>{gap}</li>)}</ul>}
              </details>
            )}

            <label className="row-start small review-check">
              <input
                type="checkbox"
                checked={draft.gapsAcknowledged}
                disabled={stale}
                onChange={(event) => void acknowledge(event.target.checked)}
              />
              <span>I have checked the missing details. Leave them blank if I cannot provide them.</span>
            </label>
          </section>

          <details className="filing-help">
            <summary>Filing information</summary>
            <div className="stack">
              <GroundedNote assertionId="filing" />
              <GroundedNote assertionId="service" />
            </div>
          </details>
        </aside>
      </div>
    </>
  );
}

export default function Page() {
  return <ViewState><Prepare /></ViewState>;
}
