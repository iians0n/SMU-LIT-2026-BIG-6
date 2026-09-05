'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, Info, Pencil } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { STEPS, SUPPORT_PLAIN, NOT_A_SCORE, NOT_A_LAWYER, ORIGIN_PLAIN } from '@/lib/plain-language';
import type { Case, Fact } from '@/lib/dashboard/contracts';

/**
 * The guided walkthrough. This is the front door.
 *
 * The dashboard is still there at /dashboard for someone who wants everything
 * at once, but it is the wrong first thing to show. Our user may be distressed,
 * may not be young, and is working from phone screenshots and memory — nine
 * destinations and a progress meter asks them to plan their own route through a
 * process they do not understand yet.
 *
 * So: one job per screen, one primary button, plain words, and never more than
 * one decision at a time. Everything on screen is either the task or the reason
 * for the task.
 */

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="guide-card">
      <p className="guide-eyebrow">Small claims — getting ready</p>
      <h1 className="guide-h1">Let&apos;s get your claim organised.</h1>
      <p className="guide-lead">
        We will ask what happened, look at any documents you have, and show you what they back
        up — and what they do not. At the end you get everything gathered in one place.
      </p>
      <p className="guide-lead">
        It takes about twenty minutes. You can stop at any point and nothing is lost.
      </p>

      <div className="guide-note">
        <Info size={22} aria-hidden="true" />
        <div>
          <strong>You are looking at a worked example.</strong>
          <p style={{ margin: '4px 0 0' }}>
            A made-up dispute about unfinished bathroom repairs, already part-way through, so you
            can see how it works. Nothing here is real and nothing is sent anywhere.
          </p>
        </div>
      </div>

      <button className="guide-primary" onClick={onStart}>
        Start <ArrowRight size={22} aria-hidden="true" />
      </button>

      <p className="guide-fineprint">{NOT_A_LAWYER}</p>
    </div>
  );
}

function StepExplain() {
  return (
    <>
      <p className="guide-lead">
        Tell us what happened in your own words. Do not worry about getting it in the right order
        or using the right words — you can change it later.
      </p>
      <Link className="guide-primary" href="/intake">
        Write or speak your account <ArrowRight size={22} aria-hidden="true" />
      </Link>
      <p className="guide-help">
        Prefer to talk? There is a microphone button on that page. Your words stay exactly as you
        say them.
      </p>
    </>
  );
}

function StepDocuments({ record }: { record: Case }) {
  const ready = record.documents.filter((d) => d.processingStatus === 'ready').length;
  const problems = record.documents.filter((d) => d.processingStatus !== 'ready');
  return (
    <>
      <p className="guide-lead">
        Add anything you already have — receipts, photos, screenshots of messages. You do not need
        to sort them or work out which ones matter.
      </p>
      <div className="guide-tally">
        <div><strong>{ready}</strong><span>we could read</span></div>
        <div><strong>{problems.length}</strong><span>need a look</span></div>
      </div>
      {problems.length > 0 && (
        <ul className="guide-list">
          {problems.slice(0, 3).map((d) => (
            <li key={d.id}>
              <CircleAlert size={20} className="icon-warn" aria-hidden="true" />
              <span>{d.name} — we could not read this one</span>
            </li>
          ))}
        </ul>
      )}
      <Link className="guide-primary" href="/documents">
        Add or check documents <ArrowRight size={22} aria-hidden="true" />
      </Link>
    </>
  );
}

function StepCheck({ record }: { record: Case }) {
  const toCheck = record.facts.filter((f) => !f.confirmedByUser && !f.unknown && !f.key.endsWith('_name'));
  const conflicting = record.facts.filter((f) => f.disputed);
  const example: Fact | undefined = conflicting[0] ?? toCheck[0];
  return (
    <>
      <p className="guide-lead">
        We read your files and wrote down what we think happened. Please check it. If anything is
        wrong, change it — what you say wins.
      </p>
      {example && (
        <div className="guide-quote">
          <p style={{ margin: 0 }}>{example.label}</p>
          <span className="guide-source">{ORIGIN_PLAIN[example.origin]}</span>
        </div>
      )}
      <div className="guide-tally">
        <div><strong>{toCheck.length}</strong><span>to check</span></div>
        <div><strong>{conflicting.length}</strong><span>where your files disagree</span></div>
      </div>
      <Link className="guide-primary" href="/chronology">
        Check what we wrote <ArrowRight size={22} aria-hidden="true" />
      </Link>
    </>
  );
}

function StepEvidence({ record }: { record: Case }) {
  const counts = record.issues.reduce<Record<string, number>>((a, i) => {
    a[i.supportStatus] = (a[i.supportStatus] ?? 0) + 1;
    return a;
  }, {});
  return (
    <>
      <p className="guide-lead">
        For each part of your claim, we looked for something in your files that backs it up. Here is
        what we found.
      </p>
      <ul className="guide-status">
        {(['supported', 'partial_or_disputed', 'missing', 'not_assessed'] as const)
          .filter((k) => counts[k])
          .map((k) => (
            <li key={k} className={`guide-status-${SUPPORT_PLAIN[k].tone}`}>
              <strong>{counts[k]}</strong>
              <span>{SUPPORT_PLAIN[k].headline.toLowerCase()}</span>
            </li>
          ))}
      </ul>
      <div className="guide-note">
        <Info size={22} aria-hidden="true" />
        <p style={{ margin: 0 }}>{NOT_A_SCORE}</p>
      </div>
      <Link className="guide-primary" href="/evidence">
        Look at each part <ArrowRight size={22} aria-hidden="true" />
      </Link>
    </>
  );
}

function StepNext() {
  return (
    <>
      <p className="guide-lead">
        There is more than one way forward, and filing a claim is only one of them. We will show you
        each option and what it needs from you — you choose.
      </p>
      <ul className="guide-list">
        <li><Check size={20} className="icon-good" aria-hidden="true" /><span>Gather more proof</span></li>
        <li><Check size={20} className="icon-good" aria-hidden="true" /><span>Try to settle it directly</span></li>
        <li><Check size={20} className="icon-good" aria-hidden="true" /><span>Get help from someone qualified</span></li>
        <li><Check size={20} className="icon-good" aria-hidden="true" /><span>Get ready to file</span></li>
      </ul>
      <Link className="guide-primary" href="/options">
        See your options <ArrowRight size={22} aria-hidden="true" />
      </Link>
    </>
  );
}

function StepPack() {
  return (
    <>
      <p className="guide-lead">
        Everything gathered into one pack you can read, correct and download — your account, your
        timeline, your documents, and a list of anything still missing.
      </p>
      <div className="guide-note">
        <Info size={22} aria-hidden="true" />
        <p style={{ margin: 0 }}>
          We do not file anything for you. When you are ready, you log in to CJTS yourself, check
          every detail, and submit it there.
        </p>
      </div>
      <Link className="guide-primary" href="/prepare">
        See your pack <ArrowRight size={22} aria-hidden="true" />
      </Link>
    </>
  );
}

function Guide() {
  const { record } = useCase();
  const [step, setStep] = useState(-1);
  if (!record) return null;

  if (step < 0) return <Welcome onStart={() => setStep(0)} />;

  const current = STEPS[step];
  const body = [
    <StepExplain key="a" />,
    <StepDocuments key="b" record={record} />,
    <StepCheck key="c" record={record} />,
    <StepEvidence key="d" record={record} />,
    <StepNext key="e" />,
    <StepPack key="f" />,
  ][step];

  return (
    <div className="guide-card">
      <div className="guide-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s.slug} className={i <= step ? 'on' : ''} aria-hidden="true" />
        ))}
      </div>
      <p className="guide-eyebrow">Step {step + 1} of {STEPS.length}</p>
      <h1 className="guide-h1">{current.title}</h1>
      {body}

      <div className="guide-nav">
        <button className="guide-secondary" onClick={() => setStep(step - 1)}>
          <ArrowLeft size={20} aria-hidden="true" /> {step === 0 ? 'Start over' : 'Back'}
        </button>
        {step < STEPS.length - 1 && (
          <button className="guide-secondary" onClick={() => setStep(step + 1)}>
            Skip for now <ArrowRight size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="guide-fineprint">
        <Pencil size={15} aria-hidden="true" /> You can change anything later. Nothing is sent
        anywhere until you decide.{' '}
        <Link href="/dashboard">See everything at once instead</Link>
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <ViewState>
      <Guide />
    </ViewState>
  );
}
