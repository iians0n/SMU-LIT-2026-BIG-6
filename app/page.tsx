'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, Mic, Paperclip, Send, Square } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { NOT_A_LAWYER, ORIGIN_PLAIN } from '@/lib/plain-language';

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

interface SpeechLike extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
function speechCtor(): (new () => SpeechLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, new () => SpeechLike>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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
  const { record, reload } = useCase();
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', content: OPENER }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speech = useRef<SpeechLike | null>(null);
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
      if (body.mutated) await reload();
    } catch (e) {
      // Their words stay on screen. A failed reply must not lose what they typed.
      setError(e instanceof Error ? e.message : 'The assistant could not reply.');
    } finally {
      setBusy(false);
    }
  }, [turns, busy, reload]);

  function toggleMic() {
    if (listening) { speech.current?.stop(); setListening(false); return; }
    const Ctor = speechCtor();
    if (!Ctor) { setError('Speaking is not supported in this browser. You can type instead.'); return; }
    const r = new Ctor();
    r.continuous = true; r.interimResults = true; r.lang = 'en-SG';
    r.onresult = (e) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      if (finalText) setDraft((d) => (d ? `${d} ${finalText.trim()}` : finalText.trim()));
    };
    r.onerror = () => { setError('The microphone stopped. You can type instead.'); setListening(false); };
    speech.current = r; r.start(); setListening(true);
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
      await reload();
      await send(`I've added these files: ${names}. Please have a look at them.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Those files could not be added.');
    } finally {
      setBusy(false);
    }
  }

  if (available === null) return <div className="loading" role="status">Getting ready…</div>;
  if (available === false) return <SetupNeeded />;

  const noted = record?.facts.filter((f) => !f.unknown && !f.key.endsWith('_name')) ?? [];

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
            <button type="button" className={`chat-icon ${listening ? 'on' : ''}`} onClick={toggleMic} disabled={busy} aria-label={listening ? 'Stop speaking' : 'Speak your answer'}>
              {listening ? <Square size={20} /> : <Mic size={22} />}
            </button>
            <button type="submit" className="chat-send" disabled={busy || !draft.trim()}>
              <Send size={20} aria-hidden="true" /> Send
            </button>
          </div>
        </form>
        <p className="chat-fineprint">{NOT_A_LAWYER}</p>
      </div>

      <aside className="chat-side">
        <h2>What we have so far</h2>
        {noted.length === 0 ? (
          <p className="muted">Nothing yet. It will fill in as you talk.</p>
        ) : (
          <ul className="chat-noted">
            {noted.slice(-8).reverse().map((f) => (
              <li key={f.id}>
                <span>{f.label}</span>
                <em>{ORIGIN_PLAIN[f.origin]}</em>
              </li>
            ))}
          </ul>
        )}
        <div className="side-rule" style={{ margin: '18px 0' }} />
        <p className="small muted">
          Nothing here is final. You can check and change all of it on{' '}
          <Link href="/chronology">the review page</Link>, and see what your files back up on{' '}
          <Link href="/evidence">the evidence page</Link>.
        </p>
        <Link className="guide-secondary" style={{ marginTop: 14 }} href="/dashboard">
          See everything at once
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
