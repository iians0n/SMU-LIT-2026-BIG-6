'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, Mic, Paperclip, Send, Square } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { NOT_A_LAWYER } from '@/lib/plain-language';
import { FORM_SOURCE, type DerivedForm } from '@/lib/cjts/form';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  actions?: string[];
}

const OPENER =
  "Hello. I'm here to help you get organised about your dispute.\n\nTell me what happened, in your own words. Don't worry about getting it in order or using the right terms — just start wherever makes sense to you.";

/**
 * Recording is done with MediaRecorder and transcribed by Whisper on the
 * server, not by the browser's own speech engine.
 *
 * The trade is deliberate: it works in every browser rather than only Chrome,
 * and handles Singapore accents and amounts far better — but the audio leaves
 * the device, so the consent wording below has to say so. FR01 requires that
 * before the microphone is activated, not after.
 */
type MicState = "idle" | "asking" | "recording" | "transcribing";

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
  const [micConsent, setMicConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<DerivedForm | null>(null);
  /** Keys that changed on the last refresh, so they can flash as they land. */
  const [justFilled, setJustFilled] = useState<Set<string>>(new Set());
  const previousForm = useRef<Map<string, string>>(new Map());
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
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
      setTurns([...next, { role: 'assistant', content: body.reply, actions: body.actions }]);
      if (body.mutated) await Promise.all([reload(), refreshForm()]);
    } catch (caught) {
      // Their words stay on screen. A failed reply must not lose what they typed.
      setError(caught instanceof Error ? caught.message : 'The assistant could not reply.');
    } finally {
      setBusy(false);
    }
  }, [turns, busy, reload, refreshForm]);

  async function startRecording() {
    setError(null);
    setMic("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = async () => {
        // Release the microphone as soon as we stop, not when the page closes.
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        chunks.current = [];
        if (blob.size === 0) { setMic("idle"); return; }

        setMic("transcribing");
        try {
          const form = new FormData();
          form.append("audio", new File([blob], "answer.webm", { type: blob.type }));
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? "That recording could not be read.");
          if (body.empty) setError("We did not catch anything. Try again, or type it.");
          // Into the box, not straight into the conversation: they read it and
          // fix it before it counts as something they said.
          else setDraft((d) => (d ? `${d} ${body.text}` : body.text));
        } catch (e) {
          setError(e instanceof Error ? e.message : "That recording could not be read.");
        } finally {
          setMic("idle");
        }
      };
      rec.start();
      recorder.current = rec;
      setMic("recording");
    } catch {
      // A refused microphone is not a dead end: typing does everything.
      setError("No microphone access, so speaking is off. You can type instead — nothing needs the microphone.");
      setMic("idle");
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    recorder.current = null;
  }

  function micButton() {
    if (mic === "recording") return stopRecording();
    if (mic === "idle") {
      // Explained once, before the microphone is ever opened.
      if (!micConsent) { setMicConsent(true); return; }
      void startRecording();
    }
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

        {micConsent && mic === 'idle' && (
          <div className="mic-consent" role="dialog" aria-label="About recording">
            <p style={{ margin: 0 }}>
              <strong>Before you speak.</strong> Your recording is sent to our speech provider to be
              turned into text, then discarded. We keep only the text, and it goes into the box
              below for you to read and correct before you send it.
            </p>
            <div className="chat-buttons" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
              <button type="button" className="chat-send" onClick={() => { setMicConsent(false); void startRecording(); }}>
                Start recording
              </button>
              <button type="button" className="chat-icon" style={{ width: 'auto', padding: '0 18px' }} onClick={() => setMicConsent(false)}>
                Not now
              </button>
            </div>
          </div>
        )}
        {mic === 'recording' && <div className="mic-live" role="status">● Recording — press the square to stop</div>}
        {mic === 'transcribing' && <div className="mic-live" role="status">Turning your words into text…</div>}

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
              className={`chat-icon ${mic === 'recording' ? 'on' : ''}`}
              onClick={micButton}
              disabled={busy || mic === 'transcribing' || mic === 'asking'}
              aria-label={mic === 'recording' ? 'Stop recording' : 'Speak your answer'}
            >
              {mic === 'recording' ? <Square size={20} aria-hidden="true" /> : <Mic size={22} aria-hidden="true" />}
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
