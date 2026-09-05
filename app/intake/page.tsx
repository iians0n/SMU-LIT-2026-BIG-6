'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, Keyboard, Mic, Pause, Play, Square } from 'lucide-react';
import { useCase } from '@/components/case-provider';
import { ViewState } from '@/components/view-state';
import { Badge, Button, PageHeader } from '@/components/ui';

/** Minimal shape of the Web Speech API; it is not in the standard DOM lib. */
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Values worth a second look before they enter the record.
 *
 * FR01 requires names, dates and amounts to be confirmed explicitly. Speech
 * recognition mishears "fifteen hundred" as "$1,500" or "50" with no drop in
 * apparent fluency, so the transcript reads perfectly while being wrong.
 */
const VALUE_PATTERN = /(?:S?\$\s?\d[\d,]*(?:\.\d{2})?)|(?:\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\b)|(?:\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b)/gi;

function highlightValues(text: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(VALUE_PATTERN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    out.push(
      <mark key={`${i}-${m[0]}`} style={{ background: 'var(--warn-bg, #fff4d6)', padding: '0 2px', borderRadius: 3 }}>
        {m[0]}
      </mark>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function VoiceIntake({ onSaved }: { onSaved: () => void }) {
  const { toast } = useCase();
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [state, setState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [micDenied, setMicDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const available = recognitionCtor() !== null;

  const stop = useCallback(() => {
    recognition.current?.stop();
    recognition.current = null;
    setInterim('');
    setState('idle');
  }, []);

  useEffect(() => () => recognition.current?.abort(), []);

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) { setMicDenied(true); return; }
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-SG';
    r.onresult = (e) => {
      let finalText = '';
      let pending = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alt = e.results[i][0];
        if (e.results[i].isFinal) finalText += alt.transcript;
        else pending += alt.transcript;
      }
      if (finalText) setTranscript((t) => (t ? `${t} ${finalText.trim()}` : finalText.trim()));
      setInterim(pending);
    };
    r.onerror = (e) => {
      // A denied microphone must not be a dead end — typing stays available and
      // nothing already captured is lost.
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMicDenied(true);
      else toast('The microphone stopped unexpectedly. Your text so far has been kept.');
      setState('idle');
    };
    r.onend = () => setInterim('');
    recognition.current = r;
    r.start();
    setState('recording');
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: transcript, source: state === 'idle' ? 'text' : 'voice' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast('Saved in your own words. Nothing has been rewritten.');
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section">
      <h2 style={{ marginTop: 0 }}>Tell us what happened</h2>

      {/* Explained before the microphone is ever touched, not after. */}
      <div className="callout callout-info" style={{ marginBottom: 16 }}>
        <Info size={19} />
        <span>
          If you speak, your browser turns speech into text on this device and we keep only the
          text. No audio is stored or sent anywhere. You can edit every word before it is saved, and
          typing works just as well.
        </span>
      </div>

      {micDenied && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <Keyboard size={19} />
          <span>
            No microphone access, so voice is off. Type below instead — nothing is lost and no
            feature depends on speaking.
          </span>
        </div>
      )}

      <div className="row-start" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {state === 'idle' && (
          <Button kind="primary" disabled={!available || micDenied} onClick={start}>
            <Mic size={16} /> {available ? 'Start speaking' : 'Voice not supported here'}
          </Button>
        )}
        {state === 'recording' && (
          <>
            <Button onClick={() => { recognition.current?.stop(); setState('paused'); }}>
              <Pause size={16} /> Pause
            </Button>
            <Button onClick={stop}><Square size={16} /> Finish</Button>
            <Badge label="Recording" tone="warn" />
          </>
        )}
        {state === 'paused' && (
          <>
            <Button kind="primary" onClick={start}><Play size={16} /> Continue</Button>
            <Button onClick={stop}><Square size={16} /> Finish</Button>
            <Badge label="Paused" tone="neutral" />
          </>
        )}
      </div>

      <label className="small muted" htmlFor="account">Your account, in your words</label>
      <textarea
        id="account"
        className="field"
        rows={9}
        value={transcript + (interim ? ` ${interim}` : '')}
        onChange={(e) => { setTranscript(e.target.value); setInterim(''); }}
        placeholder="Start anywhere. What you agreed, what went wrong, what you want to happen."
        style={{ width: '100%', marginTop: 6, lineHeight: 1.6 }}
      />

      {VALUE_PATTERN.test(transcript) && (
        <div className="callout" style={{ marginTop: 14 }}>
          <Info size={19} />
          <div>
            <strong>Check these before saving.</strong>
            <p className="small" style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
              {highlightValues(transcript)}
            </p>
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              Amounts and dates are the easiest things to mishear, and the hardest to spot later.
            </p>
          </div>
        </div>
      )}

      <div className="row-start" style={{ gap: 8, marginTop: 16 }}>
        <Button kind="primary" disabled={!transcript.trim() || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save my account'}
        </Button>
        <span className="small muted">Saved as written. We do not rewrite it.</span>
      </div>
    </section>
  );
}

interface Planned { id: string; topic: string; question: string; whyItMatters: string; reason: string }
interface TopicState { topic: string; label: string; status: 'resolved' | 'outstanding' | 'set_aside' }

function Questions() {
  const { reload, toast } = useCase();
  const [next, setNext] = useState<Planned | null>(null);
  const [topics, setTopics] = useState<TopicState[]>([]);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/questions', { cache: 'no-store' });
    if (!res.ok) return;
    const body = await res.json();
    setNext(body.next);
    setTopics(body.topics);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const run = load;
      if (!cancelled) await run();
    })();
    return () => { cancelled = true; };
  }, [load]);

  async function respond(action: 'answer' | 'skip' | 'dont_know') {
    if (!next) return;
    setBusy(true);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...next, questionId: next.id, action, answer }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setNext(body.next);
      setTopics(body.topics);
      setAnswer('');
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ marginTop: 18 }}>
      <div className="row">
        <h2 style={{ margin: 0 }}>A few questions</h2>
        {next && <Badge label={next.reason === 'conflict' ? 'Something conflicts' : 'Filling a gap'} tone={next.reason === 'conflict' ? 'warn' : 'neutral'} />}
      </div>

      {next ? (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.55, margin: 0 }}>{next.question}</p>
          <p className="small muted" style={{ margin: '8px 0 0', lineHeight: 1.55 }}>
            <strong>Why this matters.</strong> {next.whyItMatters}
          </p>
          <textarea
            className="field"
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-label="Your answer"
            style={{ width: '100%', marginTop: 12 }}
          />
          <div className="row-start" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Button kind="primary" disabled={busy || !answer.trim()} onClick={() => void respond('answer')}>Answer</Button>
            <Button kind="quiet" disabled={busy} onClick={() => void respond('dont_know')}>I don&apos;t know</Button>
            <Button kind="quiet" disabled={busy} onClick={() => void respond('skip')}>Skip for now</Button>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            Both of those are real answers. We record them and stop asking.
          </p>
        </div>
      ) : (
        <div className="row-start" style={{ gap: 10, marginTop: 16 }}>
          <CheckCircle2 size={22} className="icon-good" />
          <p style={{ margin: 0 }}>
            Nothing further to ask for now. Anything still open is recorded as unresolved rather
            than pressed.
          </p>
        </div>
      )}

      <div className="side-rule" style={{ margin: '20px 0 14px' }} />
      <div className="metric-list">
        {topics.map((t) => (
          <div className="metric" key={t.topic}>
            <span>{t.label}</span>
            <Badge
              label={t.status === 'resolved' ? 'Covered' : t.status === 'set_aside' ? 'Set aside' : 'Outstanding'}
              tone={t.status === 'resolved' ? 'good' : t.status === 'set_aside' ? 'neutral' : 'warn'}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function IntakePage() {
  const { reload } = useCase();
  return (
    <>
      <PageHeader
        eyebrow="Stage 1"
        title="Explain what happened"
        description="Speak or type. You can change anything before it becomes part of your case."
      />
      <div className="split">
        <div>
          <VoiceIntake onSaved={() => void reload()} />
          <Questions />
        </div>
        <aside className="aside">
          <h3>Your words stay yours</h3>
          <p className="small muted" style={{ lineHeight: 1.6 }}>
            What you write here is kept as you wrote it. Anything we work out from it is shown
            separately and labelled, so you can always tell the two apart.
          </p>
          <div className="side-rule" style={{ margin: '18px 0' }} />
          <h3>One question at a time</h3>
          <p className="small muted" style={{ lineHeight: 1.6 }}>
            Questions are meant to test your account, not agree with it. Some will ask about things
            that could work against you — that is the point of asking now rather than later.
          </p>
        </aside>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <ViewState>
      <IntakePage />
    </ViewState>
  );
}
