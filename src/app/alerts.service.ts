import { Injectable } from '@angular/core';

/** Chimes and spoken alerts. */
@Injectable({ providedIn: 'root' })
export class AlertsService {
  private audio: AudioContext | null = null;

  /** Browsers block audio until the user interacts; call this from click handlers. */
  unlock(): void {
    if (!this.audio) this.audio = new AudioContext();
    if (this.audio.state === 'suspended') void this.audio.resume();
  }

  /** Three quick rising tones. */
  chime(): void {
    if (!this.audio) this.audio = new AudioContext();
    const ctx = this.audio;
    const start = ctx.currentTime;
    [880, 1100, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = start + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.16);
    });
  }

  /** Short soft tone that precedes speech so you notice it. */
  private ping(): void {
    if (!this.audio) this.audio = new AudioContext();
    const ctx = this.audio;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.value = 990;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.26);
  }

  /** Speaks the text (after a soft ping). Falls back to the chime if speech isn't available. */
  speak(text: string): void {
    if (!('speechSynthesis' in window)) {
      this.chime();
      return;
    }
    this.ping();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    // Queue rather than cancel, so simultaneous alerts are all heard.
    setTimeout(() => speechSynthesis.speak(u), 250);
  }
}
