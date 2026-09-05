'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, Mic, Paperclip, Send, Square } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { NOT_A_LAWYER } from '@/lib/plain-language';
import type { DerivedForm } from '@/lib/cjts/form';

/**
 * The conversation. This is the product.
 *
 * The user talks; the assistant asks one thing at a time and writes down what
 * it is told. The panel beside it fills in as they go, so they can see the case
 * being built rather than being told it was. Everything in that panel is
 * reviewable and correctable elsewhere — nothing here is final.
 */

interface Turn { role: 'user' | 'assistant'; content: string; actions?: string[] }

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
      <p className="guide-eyebrow">Not connected yet</p>
      <h1 className="guide-h1">The assistant needs a key before it can talk.</h1>
      <p className="guide-lead">
        Everything else works without one — reading your documents, checking for conflicts, the
        route rules, the draft. Only the conversation needs a model.
      </p>
      <div className="guide-note">
        <CircleAlert size={22} aria-hidden="true" />
        <div>
          <p style={{ margin: 0 }}>Create <code>.env.local</code> in the project folder:</p>
          <pre style={{ margin: '10px 0 0', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
{`OPENAI_API_KEY=sk-...
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
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/chat');
      if (!cancelled && res.ok) setAvailable((await res.json()).available);
      else if (!cancelled) setAvailable(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, busy]);

  const refreshForm = useCallback(async () => {
    const res = await fetch('/api/form', { cache: 'no-store' });
    if (res.ok) setForm(await res.json());
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'The assistant could not reply.');
      setTurns([...next, { role: 'assistant', content: body.reply, actions: body.actions }]);
      if (body.mutated) await Promise.all([reload(), refreshForm()]);
    } catch (e) {
      // Their words stay on screen. A failed reply must not lose what they typed.
      setError(e instanceof Error ? e.message : 'The assistant could not reply.');
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
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append('files', f);
      const res = await fetch('/api/documents', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const names = body.results.map((r: { fileName: string }) => r.fileName).join(', ');
      await Promise.all([reload(), refreshForm()]);
      await send(`I've added these files: ${names}. Please have a look at them.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Those files could not be added.');
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
          {turns.map((t, i) => (
            <div key={i} className={`bubble bubble-${t.role}`}>
              {t.content.split('\n').map((line, j) => (
                <p key={j} style={{ margin: j ? '10px 0 0' : 0 }}>{line}</p>
              ))}
              {t.actions?.map((a) => (
                <span key={a} className="bubble-action">✎ {a}</span>
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
          onSubmit={(e) => { e.preventDefault(); void send(draft); }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); }
            }}
            placeholder="Type your answer, or press the microphone to speak"
            aria-label="Your message"
            rows={2}
            disabled={busy}
          />
          <div className="chat-buttons">
            <input
              ref={fileInput} type="file" multiple hidden
              onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ''; }}
            />
            <button type="button" className="chat-icon" onClick={() => fileInput.current?.click()} disabled={busy} aria-label="Add a document">
              <Paperclip size={22} />
            </button>
            <button
              type="button"
              className={`chat-icon ${mic === 'recording' ? 'on' : ''}`}
              onClick={micButton}
              disabled={busy || mic === 'transcribing' || mic === 'asking'}
              aria-label={mic === 'recording' ? 'Stop recording' : 'Speak your answer'}
            >
              {mic === 'recording' ? <Square size={20} /> : <Mic size={22} />}
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
          <span className="small muted">{form ? `${form.filled} of ${form.total}` : ''}</span>
        </div>
        <p className="small muted" style={{ margin: '4px 0 14px' }}>
          Fills in as we talk. Nothing goes in without something to point at.
        </p>

        {!form ? (
          <p className="muted">Loading…</p>
        ) : (
          form.groups.map((group) => (
            <div key={group.name} className="form-group">
              <h3>{group.name}</h3>
              {group.fields.map((f) => (
                <div key={f.key} className={`form-field form-${f.status}`}>
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
