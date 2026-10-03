'use client';

/*
 * SEED GARDEN — Tier 1 sandbox (the youngest hands).
 *
 * No goals, no scores, no failure. Quilt concepts as living things:
 *   a CELL  is a pod that holds a number and glows when it changes.
 *   a HOOK  is a vine that makes two pods friends — poke one, both wiggle.
 *   a HOP   is a critter that sits on a pod and changes numbers as they travel.
 *   a DROP  is a seed packet that carries what a pod holds somewhere new.
 *
 * Tap = experiment. The garden journal fills itself as concepts are
 * discovered. Delight is the pedagogy.
 */

import { useEffect, useRef, useState } from 'react';

type Tool = 'look' | 'cell' | 'hook' | 'hop' | 'drop';
type HopKind = '+1' | 'x2' | '~';

interface Pod {
  id: number;
  value: number;
  hue: number;          // 0..360
  growth: 1 | 2 | 3;    // sprout → bud → bloom
  wiggle: number;       // 0..1 animation energy
  hop?: HopKind;
}

interface Hook { a: number; b: number }
interface Packet { value: number; hue: number }

const TOOLS: { id: Tool; name: string; color: string; say: string }[] = [
  { id: 'look', name: 'Poke',   color: 'bg-zinc-700',    say: 'poke a pod and see it glow' },
  { id: 'cell', name: 'Cell',   color: 'bg-emerald-600', say: 'a CELL holds a number' },
  { id: 'hook', name: 'Hook',   color: 'bg-amber-600',   say: 'a HOOK makes two pods friends' },
  { id: 'hop',  name: 'Hop',    color: 'bg-fuchsia-600', say: 'a HOP changes numbers as they travel' },
  { id: 'drop', name: 'Drop',   color: 'bg-cyan-600',    say: 'a DROP carries what a pod holds' },
];

const JOURNAL_WORDS: Record<string, string> = {
  cell: 'Cells hold — every number you will ever meet lives in one.',
  hook: 'Hooks link — change travels between friends.',
  hop:  'Hops transform — a number leaves and comes back different.',
  drop: 'Drops carry — what a cell holds can move somewhere new.',
};

const PLOTS = 9; // 3x3 garden

export default function SeedGarden() {
  const [pods, setPods] = useState<(Pod | null)[]>(() => {
    const a: (Pod | null)[] = new Array(PLOTS).fill(null);
    a[4] = { id: 1, value: 3, hue: 150, growth: 2, wiggle: 0 };
    return a;
  });
  const [hooks, setHooks] = useState<Hook[]>([{ a: 1, b: 1 }]); // placeholder replaced on first real hook
  const [packets, setPackets] = useState<Packet[]>([]);
  const [tool, setTool] = useState<Tool>('look');
  const [hookFrom, setHookFrom] = useState<number | null>(null);
  const [journal, setJournal] = useState<string[]>([]);
  const [bubble, setBubble] = useState<{ pod: number; text: string } | null>(null);
  const idSeq = useRef(2);

  const say = (podId: number, text: string) => {
    setBubble({ pod: podId, text });
    window.setTimeout(() => setBubble((b) => (b && b.pod === podId ? null : b)), 1800);
  };

  const learn = (word: string) =>
    setJournal((j) => (j.includes(word) ? j : [...j, word]));

  // gentle world drift — pods change on their own; hooks share the change
  useEffect(() => {
    const t = setInterval(() => {
      setPods((ps) => {
        const changed = ps.map((p) => {
          if (!p) return p;
          const drift = Math.round((Math.random() - 0.5) * 4);
          if (drift === 0) return p;
          return { ...p, value: Math.max(0, p.value + drift), wiggle: 0.7 };
        });
        // hooks: friends follow friends
        for (const h of hooks) {
          const a = changed.find((p) => p?.id === h.a);
          const b = changed.find((p) => p?.id === h.b);
          if (!a || !b || a.id === b.id) continue;
          if (a.value !== b.value) {
            const mid = Math.round((a.value + b.value) / 2);
            a.value = Math.round((a.value + mid) / 2);
            b.value = Math.round((b.value + mid) / 2);
            a.wiggle = 1; b.wiggle = 1;
          }
        }
        return changed.map((p) => (p ? { ...p, hop: p.hop } : p));
      });
    }, 2400);
    return () => clearInterval(t);
  }, [hooks]);

  // hop critters work continuously
  useEffect(() => {
    const t = setInterval(() => {
      setPods((ps) =>
        ps.map((p) => {
          if (!p?.hop) return p;
          const before = p.value;
          const after = p.hop === '+1' ? before + 1 : p.hop === 'x2' ? before * 2 : Math.max(0, before - 1);
          if (after === before) return p;
          return { ...p, value: Math.min(99, after), wiggle: 1 };
        }),
      );
    }, 1800);
    return () => clearInterval(t);
  }, []);

  const tapPlot = (i: number) => {
    const pod = pods[i];

    if (tool === 'cell') {
      if (pod) { say(i, 'already growing here!'); return; }
      const id = idSeq.current++;
      const np: Pod = { id, value: Math.floor(Math.random() * 9), hue: Math.floor(Math.random() * 360), growth: 1, wiggle: 1 };
      setPods((ps) => ps.map((p, j) => (j === i ? np : p)));
      learn('cell');
      say(i, 'a cell sprouts — it holds!');
      return;
    }

    if (tool === 'hook') {
      if (!pod) { say(i, 'plant a cell first'); return; }
      if (hookFrom === null) { setHookFrom(i); say(i, 'now pick a friend…'); return; }
      if (hookFrom === i) { setHookFrom(null); return; }
      const a = pods[hookFrom]!, b = pod;
      setHooks((hs) => [...hs.filter((h) => h.a !== h.b), { a: a.id, b: b.id }]);
      setPods((ps) => ps.map((p) => (p && (p.id === a.id || p.id === b.id) ? { ...p, wiggle: 1, growth: Math.min(3, p.growth + 1) as 1 | 2 | 3 } : p)));
      setHookFrom(null);
      learn('hook');
      say(i, 'friends! change will travel');
      return;
    }

    if (tool === 'hop') {
      if (!pod) { say(i, 'a hop needs a pod to sit on'); return; }
      const next: HopKind = pod.hop === undefined ? '+1' : pod.hop === '+1' ? 'x2' : pod.hop === 'x2' ? '~' : undefined as unknown as HopKind;
      setPods((ps) => ps.map((p, j) => (j === i ? { ...p!, hop: next, wiggle: 1 } : p)));
      learn('hop');
      say(i, next === '+1' ? 'hop critter: +1!' : next === 'x2' ? 'hop critter: doubles!' : next === '~' ? 'hop critter: calms' : 'critter flew away');
      return;
    }

    if (tool === 'drop') {
      if (pod) {
        setPackets((pk) => [...pk, { value: pod.value, hue: pod.hue }]);
        setPods((ps) => ps.map((p, j) => (j === i ? { ...p!, wiggle: 1 } : p)));
        learn('drop');
        say(i, 'packed into a seed packet!');
      } else if (packets.length > 0) {
        const [pk, ...rest] = packets;
        const id = idSeq.current++;
        setPackets(rest);
        setPods((ps) => ps.map((p, j) => (j === i ? { id, value: pk.value, hue: pk.hue, growth: 1, wiggle: 1 } : p)));
        say(i, `planted — it kept the ${pk.value}!`);
      } else {
        say(i, 'tap a pod first to pack it');
      }
      return;
    }

    // tool === 'look' — poke
    if (!pod) { say(i, 'an empty plot — plant something!'); return; }
    setPods((ps) =>
      ps.map((p, j) =>
        j === i && p
          ? { ...p, value: Math.max(0, Math.min(99, p.value + (Math.random() < 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 3)))), wiggle: 1, growth: Math.min(3, p.growth + 1) as 1 | 2 | 3 }
          : p,
      ),
    );
    learn('cell');
    say(i, 'it changed and glowed!');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div>
        {/* tool palette — big, friendly, touch-first */}
        <div className="mb-4 flex flex-wrap gap-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTool(t.id); setHookFrom(null); }}
              className={`rounded-xl px-4 py-3 text-sm font-bold text-white transition ${t.color} ${
                tool === t.id ? 'ring-4 ring-white/40 scale-105' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p className="mb-4 text-sm text-zinc-300">
          {TOOLS.find((t) => t.id === tool)!.say}
          {tool === 'hook' && hookFrom !== null && <span className="ml-2 font-bold text-amber-300">…now tap the second pod</span>}
        </p>

        {/* the garden */}
        <div className="relative grid grid-cols-3 gap-3 rounded-2xl border border-emerald-900/50 bg-[radial-gradient(ellipse_at_center,#0c1a12,#07090b)] p-4 sm:gap-4 sm:p-6">
          {pods.map((pod, i) => (
            <button
              key={i}
              onClick={() => tapPlot(i)}
              className={`relative flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed transition-transform active:scale-95 ${
                pod ? 'border-emerald-700/60 bg-emerald-950/40' : 'border-zinc-800 bg-black/30'
              } ${hookFrom === i ? 'ring-4 ring-amber-400' : ''}`}
            >
              {pod && (
                <div
                  className="flex flex-col items-center justify-center rounded-full shadow-lg"
                  style={{
                    width: `${34 + pod.growth * 12}%`,
                    height: `${34 + pod.growth * 12}%`,
                    background: `hsl(${pod.hue} 70% 45%)`,
                    boxShadow: pod.wiggle > 0.1 ? `0 0 ${pod.wiggle * 30}px hsl(${pod.hue} 90% 60%)` : 'none',
                    transform: `scale(${1 + pod.wiggle * 0.12}) rotate(${pod.wiggle * 4}deg)`,
                    transition: 'transform 250ms ease, box-shadow 250ms ease',
                  }}
                >
                  <span className="font-mono text-lg font-black text-white drop-shadow sm:text-2xl">{pod.value}</span>
                </div>
              )}
              {pod?.hop && (
                <span className="absolute right-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-fuchsia-300">
                  {pod.hop === '~' ? '−1' : pod.hop}
                </span>
              )}
              {bubble?.pod === i && (
                <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-black shadow-xl">
                  {bubble.text}
                </span>
              )}
            </button>
          ))}
          {/* hook vines (SVG overlay) */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {hooks
              .filter((h) => h.a !== h.b)
              .map((h, idx) => {
                const ai = pods.findIndex((p) => p?.id === h.a);
                const bi = pods.findIndex((p) => p?.id === h.b);
                if (ai < 0 || bi < 0) return null;
                const ax = (ai % 3) * (100 / 3) + 100 / 6;
                const ay = Math.floor(ai / 3) * (100 / 3) + 100 / 6;
                const bx = (bi % 3) * (100 / 3) + 100 / 6;
                const by = Math.floor(bi / 3) * (100 / 3) + 100 / 6;
                return (
                  <line key={idx} x1={`${ax}%`} y1={`${ay}%`} x2={`${bx}%`} y2={`${by}%`}
                    stroke="rgba(251,191,36,0.55)" strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" />
                );
              })}
          </svg>
        </div>

        {/* packet basket */}
        {packets.length > 0 && (
          <div className="mt-4 rounded-xl border border-cyan-900/50 bg-cyan-950/30 p-3">
            <p className="mb-2 text-xs font-bold tracking-widest text-cyan-300 uppercase">seed packets (drops)</p>
            <div className="flex gap-2">
              {packets.map((pk, i) => (
                <span key={i} className="flex h-9 w-9 items-center justify-center rounded-lg font-mono text-sm font-bold text-white"
                  style={{ background: `hsl(${pk.hue} 70% 40%)` }}>
                  {pk.value}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-cyan-200/70">tap an empty plot to plant one — it keeps its number</p>
          </div>
        )}
      </div>

      {/* garden journal — self-filling discovery record */}
      <aside className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
        <h3 className="mb-1 font-mono text-xs font-bold tracking-widest text-zinc-400 uppercase">garden journal</h3>
        <p className="mb-3 text-xs text-zinc-500">concepts you have met so far — {journal.length} of 4</p>
        <div className="space-y-3">
          {Object.entries(JOURNAL_WORDS).map(([k, line]) => {
            const found = journal.includes(k);
            const t = TOOLS.find((t) => t.id === k);
            return (
              <div key={k} className={`rounded-lg border p-3 transition ${found ? 'border-zinc-600 bg-zinc-900' : 'border-zinc-800/50 bg-zinc-950 opacity-50'}`}>
                <p className="flex items-center gap-2 text-sm font-bold text-white">
                  <span className={`inline-block h-3 w-3 rounded-full ${t?.color ?? 'bg-zinc-600'}`} />
                  {found ? t?.name : '???'}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{found ? line : 'keep playing to meet this one'}</p>
              </div>
            );
          })}
        </div>
        {journal.length === 4 && (
          <p className="mt-4 rounded-lg bg-emerald-900/40 p-3 text-xs font-semibold text-emerald-200">
            You know all four! Cells, hooks, hops and drops are the whole alphabet —
            every quilt ever grown is made of just these. Try the Melon-Sandbox next door.
          </p>
        )}
      </aside>
    </div>
  );
}
