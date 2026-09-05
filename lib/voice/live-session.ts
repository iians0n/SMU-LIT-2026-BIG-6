/**
 * Hands-free listening.
 *
 * Press once and talk. Each time you pause, what you just said is transcribed
 * and sent, and the form fills — you never touch a button again. That turn
 * boundary is the whole trick: Whisper does not stream, so the natural unit is
 * "what you said between two pauses", which is also how people actually talk.
 *
 * Silence is detected from the audio itself rather than by a fixed timer,
 * because a fixed timer either cuts people off mid-sentence or leaves long dead
 * air. The recorder is stopped and restarted per segment, which is what makes a
 * complete, decodable blob available at each boundary.
 */

export interface LiveSessionCallbacks {
  /** Someone started talking. */
  onSpeechStart?: () => void;
  /** A pause ended a segment; this is the audio to transcribe. */
  onSegment: (audio: Blob) => Promise<void>;
  /** Microphone level, 0..1, for a meter that shows it is really listening. */
  onLevel?: (level: number) => void;
  onError: (message: string) => void;
}

export interface LiveSessionOptions {
  /** How long a pause has to be before it counts as the end of a turn. */
  silenceMs?: number;
  /** Below this RMS counts as silence. Room tone sits well under it. */
  threshold?: number;
  /** Segments shorter than this are noise — a cough, a chair. */
  minSpeechMs?: number;
}

export class LiveSession {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private frame = 0;
  private speaking = false;
  private speechStartedAt = 0;
  private lastLoudAt = 0;
  private stopped = false;
  /** Set while a segment is being transcribed and answered, so a new one is not cut underneath it. */
  private busy = false;

  constructor(
    private readonly cb: LiveSessionCallbacks,
    private readonly opts: LiveSessionOptions = {},
  ) {}

  private get silenceMs() {
    return this.opts.silenceMs ?? 1400;
  }
  private get threshold() {
    return this.opts.threshold ?? 0.012;
  }
  private get minSpeechMs() {
    return this.opts.minSpeechMs ?? 400;
  }

  async start(): Promise<void> {
    this.stopped = false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        // Without these, room echo reads as speech and a segment never closes.
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      this.cb.onError(
        "No microphone access, so speaking is off. You can type instead — nothing needs the microphone.",
      );
      return;
    }

    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new Ctx();
    const source = this.context.createMediaStreamSource(this.stream);
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    const samples = new Float32Array(analyser.fftSize);
    const tick = () => {
      if (this.stopped) return;
      analyser.getFloatTimeDomainData(samples);

      let sum = 0;
      for (const v of samples) sum += v * v;
      const level = Math.sqrt(sum / samples.length);
      this.cb.onLevel?.(Math.min(1, level * 12));

      const now = performance.now();
      if (level > this.threshold) {
        this.lastLoudAt = now;
        if (!this.speaking) {
          this.speaking = true;
          this.speechStartedAt = now;
          this.cb.onSpeechStart?.();
        }
      } else if (this.speaking && !this.busy && now - this.lastLoudAt > this.silenceMs) {
        this.speaking = false;
        // Long enough to be a sentence rather than a noise.
        if (now - this.speechStartedAt > this.minSpeechMs) this.closeSegment();
        else this.restartRecorder();
      }

      this.frame = requestAnimationFrame(tick);
    };

    this.beginRecording();
    this.frame = requestAnimationFrame(tick);
  }

  private beginRecording() {
    if (!this.stream || this.stopped) return;
    const rec = new MediaRecorder(this.stream);
    this.chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    rec.start();
    this.recorder = rec;
  }

  private restartRecorder() {
    // Drop whatever was captured and listen again — nothing worth sending.
    try {
      this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    this.beginRecording();
  }

  private closeSegment() {
    const rec = this.recorder;
    if (!rec) return;
    this.busy = true;

    rec.onstop = async () => {
      const audio = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
      this.chunks = [];
      // Listening resumes immediately, so they can keep talking while the
      // previous turn is still being answered.
      if (!this.stopped) this.beginRecording();
      try {
        if (audio.size > 0) await this.cb.onSegment(audio);
      } finally {
        this.busy = false;
      }
    };
    try {
      rec.stop();
    } catch {
      this.busy = false;
    }
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    try {
      this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.context?.close();
    this.context = null;
    this.cb.onLevel?.(0);
  }
}
