'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, Mic, Paperclip, RotateCcw, Send, Square } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { NOT_A_LAWYER } from '@/lib/plain-language';
import { FORM_SOURCE, type DerivedForm } from '@/lib/cjts/form';
import { LiveSession } from '@/lib/voice/live-session';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  actions?: string[];
  nextSteps?: Array<{ label: string; href: '/chronology' | '/evidence' | '/prepare' }>;
}

const OPENER =
  "Let's fill this quickly. In one message, send: your full name, ID, contact and address; the other side's name, whether they are a person or business, and their address; what you bought or agreed, the amount you are claiming, the exact date involved, what went wrong, and what you want.\n\nUse any order. If you do not know something, say so and I will set it aside.";

/**
 * Recording is done with MediaRecorder and transcribed by Whisper on the
 * server, not by the browser's own speech engine.
 *
 * The trade is deliberate: it works in every browser rather than only Chrome,
 * and handles Singapore accents and amounts far better — but the audio leaves
 * the device, so the consent wording below has to say so. FR01 requires that
 * before the microphone is activated, not after.
 */
type MicState = "idle" | "transcribing";

function SetupNeeded() {
  return (
    <div className="guide-card">
      <div className="guide-stage" aria-label="Assistant unavailable, setup required">
        <span>Assistant unavailable</span>
        <span>Setup required</span>
      </div>
      <h1 className="guide-h1">The assistant needs a key before it can talk.</h1>
      <p className="guide-lead">
        Everything else works without one — reading your documents, checking for conflicts, the
        route rules, and the draft. Only the conversation needs a model.
      </p>
      <div className="guide-note">
        <CircleAlert size={22} aria-hidden="true" />
        <div>
          <p style={{ margin: 0 }}>Create <code>.env.local</code> in the project folder:</p>
          <pre style={{ margin: '10px 0 0', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
{`OPENAI_API_KEY=sk-…
OPENAI_BASE_URL=https://api.openai.com/v1`}
          </pre>
          <p style={{ margin: '10px 0 0' }}>Then restart the server.</p>
        </div>
      </div>
      <Link className="guide-primary" href="/dashboard">
        Look at the worked example instead
      </Link>
    </div>
  );
}

function Chat() {
  const { reload } = useCase();
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', content: OPENER }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [mic, setMic] = useState<MicState>("idle");
  const [showMicConsent, setShowMicConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<DerivedForm | null>(null);
  /** Keys that changed on the last refresh, so they can flash as they land. */
  const [justFilled, setJustFilled] = useState<Set<string>>(new Set());
  const previousForm = useRef<Map<string, string>>(new Map());
  /** Hands-free: talk, pause, and the turn sends itself. */
  const [live, setLive] = useState(false);
  const [level, setLevel] = useState(0);
  const session = useRef<LiveSession | null>(null);
  /** The privacy explanation is shown once; later presses can start immediately. */
  const micConsentGiven = useRef(false);
  /** Callbacks outlive renders, so the transcript is read from a ref not state. */
  const turnsRef = useRef<Turn[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch('/api/chat');
      if (!cancelled && response.ok) setAvailable((await response.json()).available);
      else if (!cancelled) setAvailable(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [turns, busy]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const refreshForm = useCallback(async () => {
    const res = await fetch('/api/form', { cache: 'no-store' });
    if (!res.ok) return;
    const next: DerivedForm = await res.json();

    // Diff against the previous read. A field that just changed is worth
    // pointing at - in a live demo the whole story is watching the form build
    // itself out of the conversation.
    const seen = new Map<string, string>();
    const changed = new Set<string>();
    for (const group of next.groups) {
      for (const f of group.fields) {
        const signature = `${f.status}:${f.value ?? ''}`;
        seen.set(f.key, signature);
        const before = previousForm.current.get(f.key);
        if (before !== undefined && before !== signature) changed.add(f.key);
      }
    }
    previousForm.current = seen;
    setForm(next);
    if (changed.size) {
      setJustFilled(changed);
      window.setTimeout(() => setJustFilled(new Set()), 2600);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => { const run = refreshForm; if (!cancelled) await run(); })();
    return () => { cancelled = true; };
  }, [refreshForm]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    // A typed/upload turn also closes any open microphone before the reply.
    session.current?.stop();
    session.current = null;
    setLive(false);
    setLevel(0);
    const next: Turn[] = [...turns, { role: 'user', content: trimmed }];
    setTurns(next);
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'The assistant could not reply.');
      setTurns([...next, { role: 'assistant', content: body.reply, actions: body.actions, nextSteps: body.nextSteps }]);
      if (body.mutated) await Promise.all([reload(), refreshForm()]);
    } catch (caught) {
      // Their words stay on screen. A failed reply must not lose what they typed.
      setError(caught instanceof Error ? caught.message : 'The assistant could not reply.');
    } finally {
      setBusy(false);
    }
  }, [turns, busy, reload, refreshForm]);

  /**
   * Transcribe one spoken turn and answer it.
   *
   * The result goes straight into the conversation rather than into the input
   * box: in hands-free mode the pause IS the send, and routing it through a
   * box would just put a button back in the way.
   */
  const sendSpoken = useCallback(async (audio: Blob) => {
    // Each press records exactly one answer. Release the microphone before
    // uploading it, and never resume it after the assistant replies.
    session.current?.stop();
    session.current = null;
    setLive(false);
    setLevel(0);
    setMic('transcribing');
    try {
      const body = new FormData();
      body.append('audio', new File([audio], 'turn.webm', { type: audio.type }));
      const heard = await fetch('/api/transcribe', { method: 'POST', body });
      const transcript = await heard.json();
      if (!heard.ok) throw new Error(transcript.error ?? 'That could not be read.');
      if (transcript.empty || !transcript.text?.trim()) { setMic('idle'); return; }

      const next: Turn[] = [...turnsRef.current, { role: 'user', content: transcript.text.trim() }];
      setTurns(next);
      turnsRef.current = next;
      setMic('idle');
      setBusy(true);

      const chat = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const reply = await chat.json();
      if (!chat.ok) throw new Error(reply.error ?? 'The assistant could not reply.');

      const after: Turn[] = [...next, { role: 'assistant', content: reply.reply, actions: reply.actions, nextSteps: reply.nextSteps }];
      setTurns(after);
      turnsRef.current = after;
      if (reply.mutated) await Promise.all([reload(), refreshForm()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That could not be read.');
      setMic('idle');
    } finally {
      setBusy(false);
    }
  }, [reload, refreshForm]);

  async function startOver() {
    if (!window.confirm('Clear everything and start a new case? This cannot be undone.')) return;
    session.current?.stop();
    session.current = null;
    setLive(false);
    setBusy(true);
    try {
      await fetch('/api/case/reset', { method: 'POST' });
      const fresh: Turn[] = [{ role: 'assistant', content: OPENER }];
      setTurns(fresh);
      turnsRef.current = fresh;
      previousForm.current = new Map();
      setError(null);
      await Promise.all([reload(), refreshForm()]);
    } finally {
      setBusy(false);
    }
  }

  function stopListening() {
    session.current?.stop();
    session.current = null;
    setLive(false);
    setLevel(0);
  }

  function startListening() {
    setError(null);
    const started = new LiveSession({
      onSegment: sendSpoken,
      onLevel: setLevel,
      onError: (message) => {
        setError(message);
        stopListening();
      },
    });
    session.current = started;
    setLive(true);
    void started.start();
  }

  function toggleLive() {
    if (live) {
      stopListening();
      return;
    }
    // Explained once, before the microphone is ever opened.
    if (!micConsentGiven.current) {
      setShowMicConsent(true);
      return;
    }
    startListening();
  }

  async function upload(files: FileList) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const file of Array.from(files)) form.append('files', file);
      const response = await fetch('/api/documents', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const names = body.results.map((result: { fileName: string }) => result.fileName).join(', ');
      await Promise.all([reload(), refreshForm()]);
      setBusy(false);
      await send(`I've added these files: ${names}. Please have a look at them.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Those files could not be added.');
    } finally {
      setBusy(false);
    }
  }

  if (available === null) return <div className="loading" role="status">Getting ready…</div>;
  if (available === false) return <SetupNeeded />;

  return (
    <div className="chat-layout">
      <div className="chat-main">
        <div className="chat-scroll" role="log" aria-live="polite" aria-label="Conversation">
          {turns.map((turn, index) => (
            <div key={index} className={`bubble bubble-${turn.role}`}>
              {turn.content.split('\n').map((line, lineIndex) => (
                <p key={lineIndex} style={{ margin: lineIndex ? '10px 0 0' : 0 }}>{line}</p>
              ))}
              {turn.actions?.map((action) => (
                <span key={action} className="bubble-action">{action}</span>
              ))}
              {turn.nextSteps?.length ? (
                <div className="bubble-next-steps" aria-label="What to do next">
                  {turn.nextSteps.map((step) => (
                    <Link key={step.href} href={step.href} className="bubble-next-step">
                      {step.label}<ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {busy && <div className="bubble bubble-assistant bubble-thinking">Thinking…</div>}
          {error && (
            <div className="bubble bubble-error" role="alert">
              <CircleAlert size={19} aria-hidden="true" /> {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {showMicConsent && mic === 'idle' && (
          <div className="mic-consent" role="dialog" aria-label="About recording">
            <p style={{ margin: 0 }}>
              <strong>Before you speak.</strong> Your recording is sent to our speech provider to be
              turned into text, then discarded. We keep only the text and use it as your next
              answer. The microphone turns off after that answer.
            </p>
            <div className="chat-buttons" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
              <button type="button" className="chat-send" onClick={() => {
                micConsentGiven.current = true;
                setShowMicConsent(false);
                startListening();
              }}>
                Start talking
              </button>
              <button type="button" className="chat-icon" style={{ width: 'auto', padding: '0 18px' }} onClick={() => setShowMicConsent(false)}>
                Not now
              </button>
            </div>
          </div>
        )}
        {live && (
          <div className="live-bar" role="status">
            <span className={`live-dot${level > 0.08 ? ' on' : ''}`} aria-hidden="true" />
            <span className="live-meter" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span key={i} className={level * 8 > i ? 'on' : ''} />
              ))}
            </span>
            <span className="live-text">
              {mic === 'transcribing'
                ? 'Writing down what you said…'
                : busy
                  ? 'Thinking…'
                  : level > 0.08
                    ? 'Listening…'
                    : 'Go ahead — pause when you are done. Press the microphone again for your next answer.'}
            </span>
            <button type="button" className="chat-icon" onClick={toggleLive} aria-label="Stop talking">
              <Square size={18} />
            </button>
          </div>
        )}
        {!live && mic === 'transcribing' && <div className="mic-live" role="status">Writing down what you said…</div>}

        <form
          className="chat-input"
          onSubmit={(event) => { event.preventDefault(); void send(draft); }}
        >
          <textarea
            name="message"
            autoComplete="off"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Type your answer, or use the microphone…"
            aria-label="Your message"
            rows={2}
            disabled={busy}
          />
          <div className="chat-buttons">
            <input
              ref={fileInput}
              name="chat-documents"
              type="file"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files?.length) void upload(event.target.files);
                event.target.value = '';
              }}
            />
            <button type="button" className="chat-icon" onClick={() => fileInput.current?.click()} disabled={busy} aria-label="Add a document">
              <Paperclip size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`chat-icon ${live ? 'on' : ''}`}
              onClick={toggleLive}
              disabled={busy || mic === 'transcribing'}
              aria-label={live ? 'Stop talking' : 'Talk instead of typing'}
              title={live ? 'Stop talking' : 'Talk instead of typing'}
            >
              {live ? <Square size={20} aria-hidden="true" /> : <Mic size={22} aria-hidden="true" />}
            </button>
            <button type="submit" className="chat-send" disabled={busy || !draft.trim()}>
              <Send size={20} aria-hidden="true" /> Send
            </button>
          </div>
        </form>
        <p className="chat-fineprint">{NOT_A_LAWYER}</p>
      </div>

      <aside className="chat-side">
        <div className="row" style={{ alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>Your claim form</h2>
          <span className="form-count">{form ? `${form.filled} of ${form.total}` : ''}</span>
        </div>
        <div className="row" style={{ marginTop: 2 }}>
          <button type="button" className="start-over" onClick={() => void startOver()} disabled={busy}>
            <RotateCcw size={14} aria-hidden="true" /> Start a new case
          </button>
        </div>
        <p className="small muted" style={{ margin: '4px 0 10px' }}>
          The real CJTS sections, filling in as we talk. Nothing goes in without
          something to point at.
        </p>
        {form && (
          <div
            className="form-progress"
            role="progressbar"
            aria-valuenow={form.filled}
            aria-valuemin={0}
            aria-valuemax={form.total}
            aria-label={`${form.filled} of ${form.total} fields filled`}
          >
            <span style={{ width: `${form.total ? (form.filled / form.total) * 100 : 0}%` }} />
          </div>
        )}

        {form && form.outstanding.length === 0 && (
          <div className="form-complete-card">
            <div className="form-complete-title">
              <CheckCircle2 size={18} aria-hidden="true" /> Details collected
            </div>
            <p>Review the result, check your files, then download the PDF for your CJTS handoff.</p>
            <Link href="/chronology">Review details <ArrowRight size={15} aria-hidden="true" /></Link>
            <Link href="/evidence">Check evidence <ArrowRight size={15} aria-hidden="true" /></Link>
            <Link href="/prepare">Download PDF <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        )}

        {!form ? (
          <p className="muted">Loading…</p>
        ) : (
          form.groups.map((group) => (
            <div key={group.name} className="form-group">
              <h3>{group.name}</h3>
              {group.fields.map((f) => (
                <div
                  key={f.key}
                  className={`form-field form-${f.status}${justFilled.has(f.key) ? ' form-just' : ''}`}
                >
                  <span className="form-label">
                    {f.label}
                    {f.required && f.status !== 'filled' && <em> · needed</em>}
                  </span>
                  {f.status === 'filled' && (
                    <>
                      <strong>{f.value}</strong>
                      <span className="form-source">from {f.source}</span>
                    </>
                  )}
                  {f.status === 'unconfirmed' && (
                    <>
                      <strong>{f.value}</strong>
                      <span className="form-source">waiting for you to confirm this</span>
                    </>
                  )}
                  {f.status === 'missing' && <span className="form-help">{f.help}</span>}
                  {f.status === 'from_cjts' && <span className="form-help">{f.help}</span>}
                </div>
              ))}
            </div>
          ))
        )}

        <div className="side-rule" style={{ margin: '18px 0' }} />
        {/* Where the labels come from, so anyone can check the mapping rather
            than trust it. There is no downloadable claim form - CJTS is an
            online portal - so this is a worksheet, never a copy of one. */}
        <p className="small muted">
          Section names and fields are taken from the{' '}
          <a href={FORM_SOURCE.url} target="_blank" rel="noreferrer">
            {FORM_SOURCE.title}
          </a>{' '}
          ({FORM_SOURCE.pages}, retrieved {FORM_SOURCE.retrieved}). You still fill the claim in
          on CJTS itself — there is no form to download.
        </p>
        <p className="small muted">
          Check and change everything on <Link href="/chronology">the review page</Link>, then see
          what your files back up on <Link href="/evidence">the evidence page</Link>.
        </p>
        <Link className="guide-secondary" style={{ marginTop: 12 }} href="/prepare">
          Open the full pack
        </Link>
      </aside>
    </div>
  );
}

export default function Page() {
  return (
    <ViewState>
      <Chat />
    </ViewState>
  );
}
