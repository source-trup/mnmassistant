import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmText: string;
  resolve: (ok: boolean) => void;
}

/** In-app confirmation dialog (rendered by ConfirmDialog in the app shell). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<ConfirmRequest | null>(null);

  ask(title: string, message: string, confirmText = 'Delete'): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ title, message, confirmText, resolve }));
  }

  answer(ok: boolean): void {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(ok);
  }
}
