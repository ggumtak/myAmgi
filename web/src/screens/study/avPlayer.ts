// Sequential player for a card's AV tags ([sound:...] files and {{tts}} tags),
// modelled on aqt/sound.py's AVPlayer: `play()` replaces the queue, tags play
// one after another, `stop()` clears everything.
//
// Sound files come from `/media/<file>` (the host supports Range). TTS goes to
// the host's `platform.tts` when it works, else the browser's speechSynthesis,
// else it is skipped silently.
import { hostCall } from '../../host';

export type AvTag =
  | { kind: 'sound'; filename: string }
  | { kind: 'tts'; text: string; lang: string; speed: number; voices: string[] };

interface RawAvTag {
  soundOrVideo?: string | null;
  tts?: { fieldText?: string | null; lang?: string | null; speed?: number | null; voices?: string[] | null } | null;
}

/** Converts the engine's `extractAvTags` output. */
export function toAvTags(raw: RawAvTag[] | null | undefined): AvTag[] {
  return (raw ?? []).flatMap((t): AvTag[] => {
    if (t.soundOrVideo) return [{ kind: 'sound', filename: t.soundOrVideo }];
    if (t.tts) {
      return [{ kind: 'tts', text: htmlToText(t.tts.fieldText ?? ''), lang: t.tts.lang ?? '', speed: t.tts.speed || 1, voices: t.tts.voices ?? [] }];
    }
    return [];
  });
}

function htmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, '');
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
}

export function mediaUrl(filename: string): string {
  return `/media/${encodeURIComponent(filename)}`;
}

type HostTts = 'unknown' | 'yes' | 'no';

export class AvPlayer {
  private queue: AvTag[] = [];
  private audio: HTMLAudioElement | null = null;
  private current: AvTag | null = null;
  private token = 0;
  private hostTts: HostTts = 'unknown';
  private idleListeners = new Set<() => void>();

  /** True while something is playing or queued. */
  get busy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  onIdle(fn: () => void): () => void {
    this.idleListeners.add(fn);
    return () => this.idleListeners.delete(fn);
  }

  /** Replaces the queue with `tags`. With `interrupt` false the current item finishes first (Anki's "interrupt audio when answering" off). */
  play(tags: AvTag[], interrupt = true): void {
    this.queue = [...tags];
    if (interrupt || !this.current) {
      this.stopCurrent();
      this.next();
    }
  }

  stop(): void {
    this.queue = [];
    this.stopCurrent();
  }

  togglePause(): void {
    const a = this.audio;
    if (!a || !this.current) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }

  dispose(): void {
    this.stop();
    this.idleListeners.clear();
  }

  private stopCurrent(): void {
    this.token++;
    const was = this.current;
    this.current = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      try {
        this.audio.load();
      } catch {
        // ignore
      }
    }
    if (was?.kind === 'tts') this.stopTts();
  }

  private next(): void {
    const tag = this.queue.shift();
    if (!tag) {
      this.current = null;
      this.idleListeners.forEach((l) => l());
      return;
    }
    this.current = tag;
    const token = ++this.token;
    const done = () => {
      if (token !== this.token) return;
      this.current = null;
      this.next();
    };
    if (tag.kind === 'sound') this.playSound(tag.filename, done);
    else void this.speak(tag, done);
  }

  private playSound(filename: string, done: () => void): void {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
    }
    const a = this.audio;
    a.onended = done;
    a.onerror = done;
    a.src = mediaUrl(filename);
    const p = a.play();
    // Autoplay blocked or unsupported file: skip silently, like a missing file in Anki.
    if (p && typeof p.catch === 'function') p.catch(() => done());
  }

  private async speak(tag: Extract<AvTag, { kind: 'tts' }>, done: () => void): Promise<void> {
    if (!tag.text.trim()) return done();
    if (this.hostTts !== 'no') {
      try {
        await hostCall('platform.tts', { text: tag.text, lang: tag.lang, rate: tag.speed });
        this.hostTts = 'yes';
        return done();
      } catch {
        this.hostTts = 'no';
      }
    }
    const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return done();
    try {
      const u = new SpeechSynthesisUtterance(tag.text);
      u.lang = tag.lang.replace('_', '-');
      u.rate = tag.speed || 1;
      u.onend = done;
      u.onerror = done;
      synth.speak(u);
    } catch {
      done();
    }
  }

  private stopTts(): void {
    if (this.hostTts === 'yes') hostCall('platform.ttsStop').catch(() => {});
    try {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}
