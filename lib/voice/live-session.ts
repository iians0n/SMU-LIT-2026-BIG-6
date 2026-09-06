/**
 * Push-to-talk microphone capture.
 *
 * One press starts recording, the next press ends it, and everything in between
 * is transcribed as a single answer. The speaker decides where their turn ends.
 *
 * This used to close the turn by itself once the room went quiet. That only
 * works in a quiet room. Anywhere with people in it — a demo hall, a court
 * waiting area, a busy office — the noise floor never drops far enough and the
 * turn never closes, or a neighbouring conversation holds the microphone open
 * past the point the speaker had finished. Neither failure is recoverable by
 * the person talking, who has no way to see why nothing is happening.
 *
 * The level meter survived the change. A microphone with no visible response to
 * your voice is indistinguishable from a broken one, and people start repeating
 * themselves.
 */

export interface LiveSessionCallbacks {
  /** The finished take, handed over when the speaker presses stop. */
  onSegment: (audio: Blob) => Promise<void>;
  /** Microphone level, 0..1, for a meter that shows it is really listening. */
  onLevel?: (level: number) => void;
  onError: (message: string) => void;
}

export class LiveSession {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private frame = 0;
  private closed = false;

  constructor(private readonly cb: LiveSessionCallbacks) {}

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      this.cb.onError(
        "No microphone access, so speaking is off. You can type instead — nothing needs the microphone.",
      );
      return;
    }
    // Stopped while the permission prompt was open.
    if (this.closed) {
      this.release();
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
      if (this.closed) return;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += v * v;
      this.cb.onLevel?.(Math.min(1, Math.sqrt(sum / samples.length) * 12));
      this.frame = requestAnimationFrame(tick);
    };

    const rec = new MediaRecorder(this.stream);
    this.chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    // A one-second timeslice, so a long answer is already on hand in pieces
    // rather than riding on a single flush at the end.
    rec.start(1000);
    this.recorder = rec;
    this.frame = requestAnimationFrame(tick);
  }

  /**
   * End the take and hand it over to be transcribed.
   *
   * The microphone is released before `onSegment` runs, so the browser's
   * recording indicator goes out the moment the speaker presses stop rather
   * than lingering through the upload and the reply.
   */
  async finish(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.frame);
    this.cb.onLevel?.(0);

    const rec = this.recorder;
    this.recorder = null;
    const type = rec?.mimeType || "audio/webm";

    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });
    }

    const audio = this.chunks.length ? new Blob(this.chunks, { type }) : null;
    this.chunks = [];
    this.release();
    if (audio && audio.size > 0) await this.cb.onSegment(audio);
  }

  /** End the take and throw the audio away — a typed answer arrived instead. */
  stop(): void {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.frame);
    try {
      this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    this.recorder = null;
    this.chunks = [];
    this.release();
    this.cb.onLevel?.(0);
  }

  private release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.context?.close();
    this.context = null;
  }
}
