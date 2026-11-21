import { Injectable, signal } from '@angular/core';
import { SlotType } from '../gear/gear';
import { CustomItem } from '../models';

/** What to open the item editor on: one of your items (by id), or a new one with a name and slot filled in. */
export interface ItemEditorOptions {
  id?: number;
  name?: string;
  slot?: SlotType;
}

interface EditorRequest extends ItemEditorOptions {
  resolve: (item: CustomItem | null) => void;
}

/** Opens 🛠 My items (the ItemEditor dialog in the app shell). Resolves with the item as saved, or null if closed. */
@Injectable({ providedIn: 'root' })
export class ItemEditorService {
  readonly request = signal<EditorRequest | null>(null);

  open(opts: ItemEditorOptions = {}): Promise<CustomItem | null> {
    this.request()?.resolve(null);
    return new Promise((resolve) => this.request.set({ ...opts, resolve }));
  }

  /** Called by the dialog when it closes. */
  finish(item: CustomItem | null): void {
    const r = this.request();
    this.request.set(null);
    r?.resolve(item);
  }
}
