import { Injectable, signal } from '@angular/core';
import { ClassInfo } from './class-data';

/**
 * The class data (public/classes.json, built by tools/build-classes.mjs). It's only downloaded the first time the
 * Classes panel is shown.
 */
@Injectable({ providedIn: 'root' })
export class ClassService {
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly classes = signal<ClassInfo[]>([]);

  async load(): Promise<void> {
    if (this.status() === 'loading' || this.status() === 'ready') return;
    this.status.set('loading');
    try {
      const res = await fetch(new URL('classes.json', document.baseURI));
      if (!res.ok) throw new Error(String(res.status));
      this.classes.set((await res.json()) as ClassInfo[]);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
