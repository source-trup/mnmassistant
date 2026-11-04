import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { BuffEntry, BuffPanel } from '../models';
import { formatDuration, parseDuration } from '../time';
import { TrackerStore } from '../tracker.store';

type BuffState = 'idle' | 'active' | 'warn' | 'faded';

interface BuffRow {
  buff: BuffEntry;
  state: BuffState;
  text: string;
  progress: number;
}

@Component({
  selector: 'app-buff-card',
  templateUrl: './buff-card.html',
  styleUrl: './buff-card.scss',
})
export class BuffCard {
  readonly panel = input.required<BuffPanel>();
  protected readonly store = inject(TrackerStore);
  private readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly rows = computed<BuffRow[]>(() => {
    const now = this.store.now();
    return this.panel().buffs.map((buff) => {
      if (buff.endsAt === null) {
        return { buff, state: 'idle', text: formatDuration(buff.durationMs), progress: 0 };
      }
      const left = buff.endsAt - now;
      if (left <= 0) return { buff, state: 'faded', text: 'FADED', progress: 0 };
      return {
        buff,
        state: left <= buff.warnMs ? 'warn' : 'active',
        text: formatDuration(left),
        progress: Math.min(1, left / buff.durationMs),
      };
    });
  });

  /** The most common buff lengths in MnM. */
  protected readonly quickAdds = [
    { label: '10m', ms: 10 * 60_000 },
    { label: '20m', ms: 20 * 60_000 },
    { label: '35m', ms: 35 * 60_000 },
    { label: '1h', ms: 60 * 60_000 },
  ];

  protected quickAdd(ms: number): void {
    this.store.addBuff(this.panel().id, ms);
  }

  protected fmt(ms: number): string {
    return formatDuration(ms);
  }

  protected cast(b: BuffEntry): void {
    this.store.castBuff(this.panel().id, b.id);
  }

  protected stop(b: BuffEntry): void {
    this.store.stopBuff(this.panel().id, b.id);
  }

  /** Buff whose time-left box is open. */
  protected readonly editingId = signal<string | null>(null);

  /** Time left when the box opened (a snapshot, so the ticking countdown doesn't overwrite what you type). */
  protected editStart = '';

  protected editRemaining(b: BuffEntry): void {
    const left = b.endsAt === null ? 0 : b.endsAt - this.store.now();
    this.editStart = left > 0 ? formatDuration(left) : '';
    this.editingId.set(b.id);
    // Focus and select the box once it has rendered.
    afterNextRender(
      () => {
        const box = this.host.nativeElement.querySelector<HTMLInputElement>('.btime-edit');
        box?.focus();
        box?.select();
      },
      { injector: this.injector },
    );
  }

  protected applyRemaining(b: BuffEntry, input: HTMLInputElement): void {
    if (this.editingId() !== b.id) return; // already applied (Enter, then blur)
    const text = input.value.trim();
    if (text) {
      const ms = parseDuration(text);
      if (ms === null || ms <= 0) {
        input.classList.add('invalid');
        input.select();
        return;
      }
      this.store.setBuffRemaining(this.panel().id, b.id, ms);
    }
    this.editingId.set(null);
  }

  protected openEdit(): void {
    this.dlg().nativeElement.showModal();
  }

  protected closeEdit(): void {
    this.dlg().nativeElement.close();
  }

  protected addBuff(): void {
    this.store.addBuff(this.panel().id);
    if (!this.dlg().nativeElement.open) this.openEdit();
  }

  protected renamePanel(e: Event): void {
    const name = (e.target as HTMLInputElement).value.trim();
    if (name) this.store.updateBuffPanel(this.panel().id, { name });
  }

  protected renameBuff(b: BuffEntry, e: Event): void {
    const name = (e.target as HTMLInputElement).value.trim();
    if (name) this.store.updateBuff(this.panel().id, b.id, { name });
  }

  protected setTime(b: BuffEntry, field: 'durationMs' | 'warnMs', e: Event): void {
    const input = e.target as HTMLInputElement;
    const ms = parseDuration(input.value);
    input.classList.toggle('invalid', ms === null);
    if (ms !== null) this.store.updateBuff(this.panel().id, b.id, { [field]: ms });
  }

  protected async removeBuff(b: BuffEntry, e: MouseEvent): Promise<void> {
    if (e.shiftKey || (await this.confirm.ask('Remove buff?', `Remove "${b.name}" from this panel?`, 'Remove'))) {
      this.store.removeBuff(this.panel().id, b.id);
    }
  }

  protected async remove(e?: MouseEvent): Promise<void> {
    const p = this.panel();
    if (e?.shiftKey || (await this.confirm.ask('Delete buff panel?', `Delete "${p.name}" and its ${p.buffs.length} buffs?`))) {
      this.closeEdit();
      this.store.removeBuffPanel(p.id);
    }
  }
}
