'use client';

/*
 * QUILT COMPOSER — Tier 3 student studio (GarageBand / FruityLoops tier).
 *
 * The composition IS the quilt:
 *   every track lane is a CELL (its values stream as the transport runs),
 *   every patch-bay link is a HOP (echo, double, invert — transforms that
 *   read the cell they are wired to, every step, live),
 *   every saved pattern is a DROP (a nested unit you can boot back in).
 *
 * Same engine as the sandbox and the arcade — just skinned for music.
 * Play-tests become play-throughs become demo-mode: the live value row
 * at the bottom is real data streaming from the running pattern.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const STEPS = 16;

interface Lane {
  name: string;
  kind: 'action' | 'plan';
  hue: string;          // tailwind text color for lit state
  bg: string;           // lit cell bg
  op: { src: number | null; kind: 'echo' | 'double' | 'invert' };
}

const LANES: Lane[] = [
  { name: 'KICK',  kind: 'action', hue: 'text-rose-300',   bg: 'bg-rose-500',    op: { src: null, kind: 'echo' } },
  { name: 'SNARE', kind: 'action', hue: 'text-amber-300',  bg: 'bg-amber-500',   op: { src: 0, kind: 'echo' } },
  { name: 'HAT',   kind: 'action', hue: 'text-cyan-300',   bg: 'bg-cyan-500',    op: { src: 2, kind: 'invert' } },
  { name: 'BLIP',  kind: 'plan',   hue: 'text-fuchsia-300',bg: 'bg-fuchsia-500', op: { src: null, kind: 'double' } },
];

const OP_KINDS = ['echo', 'double', 'invert'] as const;

interface Drop { name: string; patterns: number[][]; ops: Lane['op'][] }

type Patterns = number[][];

function emptyPatterns(): Patterns {
  return Array.from({ length: LANES.length }, () => new Array(STEPS).fill(0));
}

function coolPatterns(): Patterns {
  const p = emptyPatterns();
  // kick: four on the floor with syncopation luck
  for (let i = 0; i < STEPS; i++) {
    if (i % 4 === 0) p[0][i] = 2;
    else if (Math.random() < 0.12) p[0][i] = 1;
  }
  // snare: backbeat
  p[1][4] = 2; p[1][12] = 2;
  if (Math.random() < 0.4) p[1][14] = 1;
  // hat: offbeats alive
  for (let i = 0; i < STEPS; i++) {
    if (i % 4 === 2) p[2][i] = 2;
    else if (Math.random() < 0.3) p[2][i] = 1;
  }
  // blip: a melody that breathes
  const scale = [1, 2, 2, 0, 1, 0, 2, 0];
  for (let i = 0; i < STEPS; i += 2) {
    const v = scale[Math.floor(Math.random() * scale.length)];
    if (v > 0) p[3][i] = v;
  }
  return p;
}

const START_PATTERNS: number[][] = (() => {
  const p = emptyPatterns();
  [0, 4, 8, 12].forEach((i) => (p[0][i] = 2));
  p[0][7] = 1;
  [4, 12].forEach((i) => (p[1][i] = 2));
  for (let i = 2; i < STEPS; i += 4) p[2][i] = 2;
  [0, 6, 10, 14].forEach((i) => (p[3][i] = (i % 8 === 0 ? 2 : 1)));
  return p;
})();

// ---------- tiny synth ----------
function makeAudio() {
  const ctx = new AudioContext();
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = () => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  };
  const gain = (v: number, t: number, dur: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(ctx.destination);
    return g;
  };
  return {
    ctx,
    kick(t: number) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
      o.connect(gain(0.9, t, 0.26)); o.start(t); o.stop(t + 0.3);
    },
    snare(t: number, v: number) {
      const n = noise(); const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1900;
      n.connect(bp); bp.connect(gain(0.5 * v, t, 0.16)); n.start(t); n.stop(t + 0.2);
    },
    hat(t: number, v: number) {
      const n = noise(); const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 7200;
      n.connect(hp); hp.connect(gain(0.25 * v, t, 0.05)); n.start(t); n.stop(t + 0.08);
    },
    blip(t: number, v: number) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = v >= 2 ? 659 : 440;
      o.connect(gain(0.16, t, 0.12)); o.start(t); o.stop(t + 0.14);
    },
  };
}

export default function QuiltComposer() {
  const [patterns, setPatterns] = useState<Patterns>(START_PATTERNS);
  const [ops, setOps] = useState<Lane['op'][]>(LANES.map((l) => ({ ...l.op })));
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [bpm, setBpm] = useState(112);
  const [drops, setDrops] = useState<Drop[]>([]);
  const audio = useRef<ReturnType<typeof makeAudio> | null>(null);
  const stepRef = useRef(-1);
  const patternsRef = useRef(patterns);          // for the transport tick only
  useEffect(() => { patternsRef.current = patterns; }, [patterns]);

  // pats: pass explicitly during render; the transport tick reads the ref.
  const effective = useCallback((lane: number, s: number, pats?: Patterns): number => {
    const P = pats ?? patternsRef.current;
    const own = P[lane][s];
    const op = ops[lane];
    if (op.src === null || op.src === lane) return own;
    const srcVal = P[op.src][(s + (op.kind === 'echo' ? STEPS - 1 : 0)) % STEPS];
    if (op.kind === 'echo') return Math.max(own, srcVal);
    if (op.kind === 'double') return srcVal > 0 ? Math.max(own, srcVal) : own;
    if (op.kind === 'invert') return srcVal === 0 && own === 0 ? 1 : own;
    return own;
  }, [ops]);

  // transport
  useEffect(() => {
    if (!playing) return;
    if (!audio.current) audio.current = makeAudio();
    audio.current.ctx.resume();
    const interval = 60000 / bpm / 4;
    const tick = () => {
      const s = (stepRef.current + 1) % STEPS;
      stepRef.current = s;
      setStep(s);
      const a = audio.current!;
      const t = a.ctx.currentTime + 0.01;
      const k = effective(0, s), sn = effective(1, s), h = effective(2, s), b = effective(3, s);
      if (k > 0) a.kick(t);
      if (sn > 0) a.snare(t, sn);
      if (h > 0) a.hat(t, h);
      if (b > 0) a.blip(t, b);
    };
    const t = setInterval(tick, interval);
    return () => clearInterval(t);
  }, [playing, bpm, effective]);

  const toggleTransport = () => {
    setPlaying((p) => !p);
    setStep(-1);
    stepRef.current = -1;
  };

  const cycleCell = (lane: number, i: number) =>
    setPatterns((p) => p.map((row, li) => (li === lane ? row.map((v, j) => (j === i ? (v + 1) % 3 : v)) : row)));

  const cycleOp = (lane: number, which: 'src' | 'kind') =>
    setOps((o) => o.map((op, li) => {
      if (li !== lane) return op;
      if (which === 'kind') {
        const k = OP_KINDS[(OP_KINDS.indexOf(op.kind) + 1) % OP_KINDS.length];
        return { ...op, kind: k, src: op.src ?? (lane + 1) % LANES.length };
      }
      const next = op.src === null ? (lane + 1) % LANES.length : (op.src + 1) % (LANES.length + 1);
      return { ...op, src: next === lane ? null : next };
    }));

  const saveDrop = () => {
    const name = `drop-${String.fromCharCode(65 + drops.length)}-${bpm}`;
    setDrops((d) => [...d, { name, patterns: JSON.parse(JSON.stringify(patterns)), ops: JSON.parse(JSON.stringify(ops)) }]);
  };

  const loadDrop = (i: number) => {
    const d = drops[i];
    setPatterns(JSON.parse(JSON.stringify(d.patterns)));
    setOps(JSON.parse(JSON.stringify(d.ops)));
  };

  const cellVisual = (lane: number, i: number) => {
    const own = patterns[lane][i];
    const eff = effective(lane, i, patterns); // render reads state, not refs
    const isGhost = own === 0 && eff > 0; // value arriving via a hop
    const isNow = playing && step === i;
    return (
      <button
        key={i}
        onClick={() => cycleCell(lane, i)}
        className={`h-7 w-full rounded transition-all sm:h-8 ${
          own > 0 ? `${LANES[lane].bg} ${own === 2 ? 'opacity-100' : 'opacity-55'}` : isGhost ? 'border border-dashed border-zinc-500 bg-zinc-900' : 'bg-zinc-900'
        } ${isNow ? 'ring-2 ring-white scale-y-125' : ''} hover:bg-zinc-700`}
        title={`step ${i + 1}: ${own === 0 ? 'rest' : `velocity ${own}`}${isGhost ? ' (arrives via hop)' : ''}`}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* transport */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
        <button
          onClick={toggleTransport}
          className={`rounded-lg px-5 py-2 text-sm font-bold transition ${playing ? 'bg-rose-500 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
        >
          {playing ? '■ stop' : '▶ play'}
        </button>
        <label className="flex items-center gap-2 font-mono text-xs text-zinc-400">
          bpm
          <input type="range" min={80} max={160} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-28 accent-white" />
          <span className="w-7 tabular-nums text-white">{bpm}</span>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => setPatterns(coolPatterns())} className="rounded-lg border border-fuchsia-700 bg-fuchsia-950/50 px-3 py-2 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-900/50">✦ generate me something cool</button>
          <button onClick={() => setPatterns(emptyPatterns())} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-500">clear</button>
          <button onClick={saveDrop} className="rounded-lg border border-cyan-700 bg-cyan-950/50 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/50">⤓ save as drop</button>
        </div>
      </div>

      {/* lanes */}
      <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
        {LANES.map((lane, li) => (
          <div key={lane.name} className="grid grid-cols-[92px_1fr] items-center gap-2 sm:grid-cols-[110px_1fr_170px]">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${lane.kind === 'action' ? 'bg-rose-400' : 'bg-fuchsia-400'}`} />
              <span className={`font-mono text-xs font-bold tracking-wider ${lane.hue}`}>{lane.name}</span>
            </div>
            <div className="grid grid-cols-16 gap-0.5" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
              {Array.from({ length: STEPS }, (_, i) => cellVisual(li, i))}
            </div>
            {/* patch bay — the hop wiring */}
            <div className="col-span-2 flex items-center gap-1.5 font-mono text-[10px] sm:col-span-1">
              <button onClick={() => cycleOp(li, 'src')} className="rounded border border-zinc-700 px-1.5 py-1 text-zinc-300 hover:border-zinc-500" title="which cell this hop reads">
                hop← {ops[li].src === null ? '—' : LANES[ops[li].src].name}
              </button>
              <button onClick={() => cycleOp(li, 'kind')} className="rounded border border-fuchsia-800 bg-fuchsia-950/40 px-1.5 py-1 text-fuchsia-300 hover:bg-fuchsia-900/50" title="what the hop does">
                {ops[li].kind}
              </button>
            </div>
          </div>
        ))}
        {/* live value row — real data streaming from the run */}
        <div className="mt-3 grid grid-cols-[92px_1fr] items-center gap-2 border-t border-zinc-800 pt-3 sm:grid-cols-[110px_1fr_170px]">
          <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">live cells</span>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
            {playing && LANES.map((lane, li) => (
              <span key={lane.name} className={`col-span-16 grid gap-0.5 text-center font-mono text-[9px]`} style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                {Array.from({ length: STEPS }, (_, i) => (
                  <span key={i} className={i === step ? `${lane.hue} font-bold` : 'text-zinc-800'}>
                    {effective(li, i, patterns) || '·'}
                  </span>
                ))}
              </span>
            ))}
            {!playing && <span className="col-span-16 text-center font-mono text-[10px] text-zinc-600">press play — every lane is a cell; its value streams here, every step</span>}
          </div>
          <span />
        </div>
      </div>

      {/* drops shelf */}
      <div className="rounded-2xl border border-cyan-900/50 bg-cyan-950/20 p-4">
        <h3 className="mb-2 font-mono text-xs font-bold tracking-widest text-cyan-300 uppercase">drops shelf — nested units, bootable</h3>
        {drops.length === 0 ? (
          <p className="text-sm text-zinc-400">Shape a pattern you like, then <span className="text-cyan-200">save as drop</span>. A drop is the whole quilt — lanes, values, hop wiring — folded into one bootable unit. Load it back any time.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {drops.map((d, i) => (
              <button key={d.name} onClick={() => loadDrop(i)}
                className="rounded-lg border border-cyan-700/60 bg-cyan-950/60 px-3 py-1.5 font-mono text-xs text-cyan-200 hover:bg-cyan-900/60">
                {d.name} ⤒
              </button>
            ))}
          </div>
        )}
      </div>

      {/* the lesson */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
        <p className="text-sm leading-relaxed text-zinc-300">
          <span className="font-bold text-white">You just made a quilt.</span> The lanes are cells that
          hold values. The patch bay wires hops between them — <span className="text-fuchsia-300">echo</span> copies a
          neighbor&apos;s past, <span className="text-fuchsia-300">double</span> borrows its energy,{' '}
          <span className="text-fuchsia-300">invert</span> fills its silences. Dashed cells are values
          arriving through a hop instead of living in the lane. This is the same geometry the agent
          in the sandbox used and the pong quilt uses — composed, not coded.
        </p>
      </div>
    </div>
  );
}
