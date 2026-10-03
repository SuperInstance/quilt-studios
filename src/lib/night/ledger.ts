/*
 * THE NIGHT LEDGER — erised arrangements for the quilt-studios.
 *
 * An append-only receipt chain for a ttrpg night where AI characters
 * improvise. House laws, inherited from the erised family:
 *
 *  1. Everything that lands is a receipt {seq, op, who, payload, sticky, prev, tip}.
 *  2. tip = sha256(seq|op|who|payload|sticky|prev) — the chain is verified by name.
 *  3. Rewind is APPENDED, never truncating: the ledger keeps every beat,
 *     even unwound ones ("past replays byte-identical, future re-rolls
 *     because tips changed").
 *  4. Scars are sticky — they survive rewind. Breakdowns are booked, not patched over.
 *  5. Platonic dice: seedMaterial = prevTip|seq|solid|n → sha256 → mulberry32.
 *     Rolls are pure functions of the ledger, citable forever.
 *  6. A mix pass is itself a valid chain: splices and repairs are receipts too.
 *
 * "the engine doesn't care who narrates; it only cares that everything
 *  lands as receipts."
 */

// ---------- compact sync sha256 (pure TS, same value in browser, bun, node) ----------
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(msg: string): string {
  const bytes = new TextEncoder().encode(msg);
  const l = bytes.length;
  const bitLen = l * 8;
  const padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[l] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return Array.from(H).map((x) => x.toString(16).padStart(8, '0')).join('');
}

// ---------- platonic randomness ----------
export type Solid = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';
const SOLID_MAX: Record<Solid, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RollReceipt {
  solid: Solid; n: number; rolls: number[]; sum: number;
  seed: string; seedMaterial: string; why: string;
}

export function platonicRoll(seedMaterial: string, solid: Solid, n: number, why: string): RollReceipt {
  const seedHash = sha256(seedMaterial);
  const seedInt = parseInt(seedHash.slice(0, 8), 16) >>> 0;
  const rng = mulberry32(seedInt);
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(rng() * SOLID_MAX[solid]));
  return {
    solid, n, rolls,
    sum: rolls.reduce((a, b) => a + b, 0),
    seed: seedHash.slice(0, 16),
    seedMaterial, why,
  };
}

// ---------- the ledger ----------
export type BeatOp =
  | 'night.open' | 'scene.enter' | 'scene.leave' | 'night.close'
  | 'say' | 'act' | 'roll' | 'checkpoint' | 'scar' | 'rewind'
  | 'splice' | 'repair';

export interface Beat {
  seq: number;
  op: BeatOp;
  who: string;          // character id, 'GM', 'TABLE', 'MIX'
  payload: string;      // what landed (text or compact JSON)
  sticky: boolean;      // scars survive rewind; checkpoints are structural
  prev: string;
  tip: string;
  roll?: RollReceipt;   // for op === 'roll'
  t: number;            // wall clock ms — display only, never hashed
}

function tipOf(seq: number, op: BeatOp, who: string, payload: string, sticky: boolean, prev: string): string {
  return sha256(`${seq}|${op}|${who}|${payload}|${sticky ? 1 : 0}|${prev}`);
}

export class NightLedger {
  beats: Beat[] = [];
  nightId: string;

  constructor(nightId: string) {
    this.nightId = nightId;
  }

  get lastTip(): string {
    return this.beats.length ? this.beats[this.beats.length - 1].tip : 'genesis';
  }

  get nextSeq(): number {
    return this.beats.length + 1;
  }

  append(op: BeatOp, who: string, payload: string, sticky = false): Beat {
    const seq = this.nextSeq;
    const prev = this.lastTip;
    const tip = tipOf(seq, op, who, payload, sticky, prev);
    const beat: Beat = { seq, op, who, payload, sticky, prev, tip, t: Date.now() };
    this.beats.push(beat);
    return beat;
  }

  /** platonic dice — pure function of the chain: prevTip|seq|solid|n */
  roll(who: string, solid: Solid, n: number, why: string): { beat: Beat; receipt: RollReceipt } {
    const seedMaterial = `${this.lastTip}|${this.nextSeq}|${solid}|${n}`;
    const receipt = platonicRoll(seedMaterial, solid, n, why);
    const beat = this.append('roll', who, `${receipt.sum} (${receipt.rolls.join(', ')}) — ${why}`, false);
    beat.roll = receipt;
    return { beat, receipt };
  }

  /**
   * Rewind APPENDS. The view (see viewBeats) drops non-sticky beats after
   * toSeq; scars and checkpoints survive. Unwound beats stay in the ledger —
   * still citable, still hashed. Future rolls re-roll because prevTip changed.
   */
  rewind(toSeq: number, why: string): Beat {
    return this.append('rewind', 'GM', JSON.stringify({ toSeq, why }), false);
  }

  /**
   * The story as it currently stands: fold the ledger, honoring rewind
   * receipts. Sticky beats (scars) survive any rewind. Unwound beats are
   * not deleted — they simply stop being in the present.
   */
  viewBeats(): Beat[] {
    const view: Beat[] = [];
    for (const b of this.beats) {
      if (b.op === 'rewind') {
        const { toSeq } = JSON.parse(b.payload) as { toSeq: number };
        for (let i = view.length - 1; i >= 0; i--) {
          if (view[i].seq > toSeq && !view[i].sticky) view.splice(i, 1);
        }
      } else {
        view.push(b);
      }
    }
    return view;
  }

  scars(): Beat[] {
    return this.beats.filter((b) => b.sticky);
  }

  verify(): { ok: boolean; brokenAt?: number; error?: string } {
    let prev = 'genesis';
    for (const b of this.beats) {
      const expect = tipOf(b.seq, b.op, b.who, b.payload, b.sticky, prev);
      if (b.tip !== expect) return { ok: false, brokenAt: b.seq, error: 'RECEIPT_HASH_MISMATCH' };
      if (b.prev !== prev) return { ok: false, brokenAt: b.seq, error: 'CUSTODY_GAP' };
      prev = b.tip;
    }
    return { ok: true };
  }
}

// ---------- the mix pass — itself a valid chain ----------
export interface Splice {
  fromRunId: string; fromSeq: number; text: string; who: string; why: string;
}
export interface Repair {
  atSeq: number; kind: 'continuity' | 'voice' | 'timeline'; before: string; after: string; why: string;
}

export function buildMixedNight(
  mixId: string,
  sources: { runId: string; ledger: NightLedger }[],
  picks: { runId: string; seq: number; why: string }[],
  repairs: Repair[],
): NightLedger {
  const mix = new NightLedger(mixId);
  mix.append('night.open', 'MIX', `the mixed night — assembled from ${sources.map((s) => s.runId).join(' + ')}; every splice and repair is a receipt`, true);
  for (const p of picks) {
    const src = sources.find((s) => s.runId === p.runId.split('#')[0]);
    const beat = src?.ledger.beats.find((b) => b.seq === p.seq);
    if (!beat) continue;
    mix.append('splice', beat.who, `${beat.payload} ⟨from ${p.runId}·${p.seq}: ${p.why}⟩`, beat.sticky);
  }
  for (const r of repairs) {
    mix.append('repair', 'MIX', JSON.stringify(r), true);
  }
  mix.append('night.close', 'MIX', 'the night reads as one sitting — canon patched, continuity repaired', true);
  return mix;
}
