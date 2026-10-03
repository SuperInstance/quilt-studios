/*
 * QUILT STUDIOS — the one engine under all four rungs.
 *
 * Geometric truth, not language truth:
 *   a CELL holds.      (a value, glowing when it changes)
 *   a HOOK links.      (two cells become friends)
 *   a HOP transforms.  (a value travels and comes back changed)
 *   a LAYER sequences. (cells row into time)
 *   the ORCHESTRATOR asks.  (a JEV-style consult, counted, paid in calls)
 *   the DECOMPOSER untangles. (the slow big agent, woken by stuck-ness)
 *
 * Every studio — Seed Garden, Melon-Sandbox, Quilt Composer, Pong X-Ray —
 * is a skin on this same geometry. Essence, skinned with use-case.
 */

export type CellKind =
  | 'sensor'   // reads the world
  | 'input'    // reads the human
  | 'value'    // holds
  | 'plan'     // decides
  | 'memory'   // remembers
  | 'action';  // touches the world

export interface QuiltCell {
  id: string;
  label: string;
  kind: CellKind;
  value: number;
  prev: number;
  history: number[];
  glow: number;        // 0..1, decays each tick
  updatedTick: number;
  meta?: string;       // tiny annotation, e.g. "learned" / "asked"
}

export interface HopDef {
  id: string;
  label: string;
  fn: (v: number, ctx: { tick: number; memory: Map<string, number> }) => number;
}

export type QuiltEvent =
  | { type: 'cell-update'; cellId: string; value: number }
  | { type: 'call'; reason: string }                 // orchestrator consult
  | { type: 'learned'; entry: string }               // internalized, no call needed
  | { type: 'decomposer-wake'; reason: string }
  | { type: 'decomposer-adjust'; detail: string }
  | { type: 'decomposer-sleep' }
  | { type: 'milestone'; detail: string };

type Listener = (e: QuiltEvent) => void;

export interface OrchestratorStats {
  calls: number;
  learned: number;
  confidence: number;   // 0..1 — how much of behavior is internal now
  lastCallTick: number;
}

export interface DecomposerStats {
  awake: boolean;
  wakeCount: number;
  adjustments: number;
  reason: string;
}

const HISTORY_LEN = 48;

export class QuiltEngine {
  readonly cells = new Map<string, QuiltCell>();
  readonly hooks: { from: string; to: string; label: string }[] = [];
  readonly hops: HopDef[] = [];
  tick = 0;
  private listeners = new Set<Listener>();
  private memory = new Map<string, number>();

  orchestrator: OrchestratorStats = {
    calls: 0,
    learned: 0,
    confidence: 0,
    lastCallTick: -1,
  };

  decomposer: DecomposerStats = {
    awake: false,
    wakeCount: 0,
    adjustments: 0,
    reason: '',
  };

  // The lookup table: internalized experience. When a situation is in here
  // with enough strength, no orchestrator call is needed — the quilt acts
  // from what it already is.
  private table = new Map<string, { value: number; strength: number }>();

  constructor(cellDefs: { id: string; label: string; kind: CellKind; value?: number }[]) {
    for (const d of cellDefs) {
      this.cells.set(d.id, {
        id: d.id,
        label: d.label,
        kind: d.kind,
        value: d.value ?? 0,
        prev: d.value ?? 0,
        history: new Array(HISTORY_LEN).fill(d.value ?? 0),
        glow: 0,
        updatedTick: -1,
      });
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(e: QuiltEvent) {
    for (const fn of this.listeners) fn(e);
  }

  step() {
    this.tick++;
    for (const c of this.cells.values()) {
      if (c.glow > 0) c.glow = Math.max(0, c.glow - 0.08);
    }
  }

  set(id: string, value: number, meta?: string) {
    const c = this.cells.get(id);
    if (!c) return;
    c.prev = c.value;
    c.value = value;
    c.updatedTick = this.tick;
    c.glow = 1;
    if (meta) c.meta = meta;
    c.history.push(value);
    if (c.history.length > HISTORY_LEN) c.history.shift();
    this.emit({ type: 'cell-update', cellId: id, value });
  }

  get(id: string): number {
    return this.cells.get(id)?.value ?? 0;
  }

  /**
   * The call economy. Consult the orchestrator only when the table
   * hasn't internalized this situation yet. Every consult both costs
   * a call and teaches the table — so calls fall over time as the
   * quilt needs less and less from outside.
   */
  consult(
    situationKey: string,
    fallback: () => number,
    learnFrom: (v: number) => number,
  ): { value: number; called: boolean } {
    const entry = this.table.get(situationKey);
    if (entry && entry.strength >= 1) {
      // internalized — act from self, zero calls
      this.orchestrator.learned = this.table.size;
      this.orchestrator.confidence = this.computeConfidence();
      this.emit({ type: 'learned', entry: situationKey });
      return { value: entry.value, called: false };
    }
    // The ask.
    this.orchestrator.calls++;
    this.orchestrator.lastCallTick = this.tick;
    const v = fallback();
    this.emit({ type: 'call', reason: situationKey });
    const taught = learnFrom(v);
    const prev = this.table.get(situationKey);
    this.table.set(situationKey, {
      value: taught,
      strength: Math.min(1, (prev?.strength ?? 0) + 0.34),
    });
    this.orchestrator.learned = this.table.size;
    this.orchestrator.confidence = this.computeConfidence();
    return { value: taught, called: true };
  }

  reinforce(situationKey: string, value: number, amount = 0.2) {
    const entry = this.table.get(situationKey);
    if (!entry) return;
    entry.strength = Math.min(1, entry.strength + amount);
    entry.value = value;
    this.orchestrator.confidence = this.computeConfidence();
  }

  tableSize(): number {
    return this.table.size;
  }

  /** Rewind the call economy to zero — a fresh stable point for the run. */
  resetOrchestrator(): void {
    this.orchestrator.calls = 0;
    this.orchestrator.lastCallTick = -1;
    this.table.clear();
    this.orchestrator.learned = 0;
    this.orchestrator.confidence = 0;
  }

  private computeConfidence(): number {
    if (this.table.size === 0) return 0;
    let sum = 0;
    for (const e of this.table.values()) sum += e.strength;
    return sum / this.table.size;
  }

  /**
   * The decomposer — the slow big agent. Called when a run is stuck
   * (misses, silence, repeated failure). Wakes, adjusts wiring, sleeps.
   * Each wake leaves the quilt more able than before.
   */
  wakeDecomposer(reason: string, adjustments: string[]): void {
    this.decomposer.awake = true;
    this.decomposer.wakeCount++;
    this.decomposer.reason = reason;
    this.emit({ type: 'decomposer-wake', reason });
    // Slow, visible, periodic: one adjustment per beat.
    adjustments.forEach((detail, i) => {
      setTimeout(() => {
        this.decomposer.adjustments++;
        this.emit({ type: 'decomposer-adjust', detail });
        if (i === adjustments.length - 1) {
          setTimeout(() => {
            this.decomposer.awake = false;
            this.emit({ type: 'decomposer-sleep' });
          }, 900);
        }
      }, 700 * (i + 1));
    });
  }

  snapshot(): { cells: QuiltCell[]; orchestrator: OrchestratorStats; decomposer: DecomposerStats; tick: number } {
    return {
      cells: [...this.cells.values()].map((c) => ({ ...c, history: [...c.history] })),
      orchestrator: { ...this.orchestrator },
      decomposer: { ...this.decomposer },
      tick: this.tick,
    };
  }
}

/** Color language shared by every studio — kinds map to one palette. */
export const CELL_KIND_COLOR: Record<CellKind, { ring: string; text: string; dot: string; word: string }> = {
  sensor: { ring: 'border-emerald-400/60', text: 'text-emerald-300', dot: 'bg-emerald-400', word: 'reads the world' },
  input:  { ring: 'border-amber-400/60',    text: 'text-amber-300',    dot: 'bg-amber-400',    word: 'reads the human' },
  value:  { ring: 'border-zinc-400/50',     text: 'text-zinc-200',     dot: 'bg-zinc-400',     word: 'holds' },
  plan:   { ring: 'border-fuchsia-400/60',  text: 'text-fuchsia-300',  dot: 'bg-fuchsia-400',  word: 'decides' },
  memory: { ring: 'border-cyan-400/60',     text: 'text-cyan-300',     dot: 'bg-cyan-400',     word: 'remembers' },
  action: { ring: 'border-rose-400/60',     text: 'text-rose-300',     dot: 'bg-rose-400',     word: 'touches the world' },
};

export function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}
