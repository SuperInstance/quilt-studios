'use client';

/*
 * QuiltXRay — the reusable scroll-reveal shell.
 *
 * The promise: a simulation plays at the top; as you scroll down, the
 * functional quilt layers are running underneath — real-time values,
 * cells lighting up when the world or the human moves. One x-ray for
 * every studio, so the pattern itself becomes the lesson: everything
 * playful has a living quilt underneath it.
 */

import { useEffect, useRef, useState } from 'react';
import {
  QuiltEngine,
  CELL_KIND_COLOR,
  fmt,
  type QuiltCell,
  type QuiltEvent,
} from '@/lib/quilt/engine';

export interface CellLayerDef {
  label: string;
  blurb: string;
  cellIds: string[];
}

interface Props {
  engine: QuiltEngine;
  layers: CellLayerDef[];
  children: React.ReactNode;              // the simulation viewport
  simTitle: string;
  simBlurb: string;
  scrollHint?: string;
}

interface FeedItem {
  id: number;
  kind: 'call' | 'learned' | 'wake' | 'adjust' | 'sleep' | 'milestone';
  text: string;
}

let feedSeq = 0;

function Sparkline({ history, accent }: { history: number[]; accent: string }) {
  const w = 72;
  const h = 18;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const pts = history
    .map((v, i) => `${(i / (history.length - 1)) * w},${h - ((v - min) / span) * (h - 3) - 1.5}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="opacity-70 shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={accent} strokeWidth="1.2" />
    </svg>
  );
}

function CellCard({ cell }: { cell: QuiltCell }) {
  const color = CELL_KIND_COLOR[cell.kind];
  const glowing = cell.glow > 0.05;
  const delta = cell.value - cell.prev;
  return (
    <div
      className={`
        relative rounded-lg border ${color.ring} bg-zinc-950/80 px-3 py-2
        transition-shadow duration-150 overflow-hidden min-w-[124px]
        ${glowing ? 'shadow-[0_0_18px_-2px_rgba(255,255,255,0.35)]' : ''}
      `}
      style={glowing ? { boxShadow: `0 0 ${8 + cell.glow * 18}px -2px currentColor` } : undefined}
    >
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${color.dot}`} />
        <span className="font-mono text-[10px] tracking-widest text-zinc-400 uppercase">{cell.label}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span
          className={`font-mono text-lg leading-none tabular-nums ${color.text}`}
          style={glowing ? { opacity: 0.65 + cell.glow * 0.35 } : undefined}
        >
          {fmt(cell.value)}
        </span>
        <Sparkline history={cell.history} accent={glowing ? 'currentColor' : '#52525b'} />
      </div>
      <div className="mt-0.5 flex justify-between font-mono text-[9px] text-zinc-600">
        <span>{color.word}</span>
        <span className={delta !== 0 ? (delta > 0 ? 'text-emerald-500' : 'text-rose-500') : ''}>
          {delta !== 0 ? `${delta > 0 ? '+' : ''}${fmt(delta)}` : cell.meta ?? '·'}
        </span>
      </div>
      {/* glow pulse overlay */}
      {glowing && (
        <span
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{ background: `radial-gradient(circle at 50% 100%, rgba(255,255,255,${cell.glow * 0.14}), transparent 70%)` }}
        />
      )}
    </div>
  );
}

const FEED_STYLE: Record<FeedItem['kind'], string> = {
  call: 'text-fuchsia-300',
  learned: 'text-emerald-300',
  wake: 'text-amber-300 font-semibold',
  adjust: 'text-cyan-300',
  sleep: 'text-zinc-500',
  milestone: 'text-white font-semibold',
};

export default function QuiltXRay({ engine, layers, children, simTitle, simBlurb, scrollHint }: Props) {
  const [, force] = useState(0);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // Event feed (calls, learned entries, decomposer).
  useEffect(() => {
    const push = (kind: FeedItem['kind'], text: string) => {
      setFeed((f) => [{ id: ++feedSeq, kind, text }, ...f].slice(0, 24));
    };
    const unsub = engine.subscribe((e: QuiltEvent) => {
      if (e.type === 'call') push('call', `orchestrator consult — "${e.reason}" (call #${engine.orchestrator.calls})`);
      else if (e.type === 'learned') push('learned', `no call needed — "${e.entry}" is internal now`);
      else if (e.type === 'decomposer-wake') push('wake', `DECOMPOSER wakes — ${e.reason}`);
      else if (e.type === 'decomposer-adjust') push('adjust', `adjust: ${e.detail}`);
      else if (e.type === 'decomposer-sleep') push('sleep', 'decomposer sleeps — quilt left more able');
      else if (e.type === 'milestone') push('milestone', e.detail);
    });
    return unsub;
  }, [engine]);

  // Slow display tick — canvas sims run their own 60fps loops; the cell
  // layer re-renders at ~14Hz, which is plenty for values and glow.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 70);
    return () => clearInterval(t);
  }, []);

  const snap = engine.snapshot();
  const o = snap.orchestrator;
  const d = snap.decomposer;

  return (
    <div className="space-y-6">
      {/* ============ TOP: the simulation ============ */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-white">{simTitle}</h3>
            <p className="text-sm text-zinc-400">{simBlurb}</p>
          </div>
          <span className="rounded-full border border-zinc-700 px-3 py-1 font-mono text-[10px] tracking-widest text-zinc-400 uppercase">
            frontend · plays at 60fps
          </span>
        </div>
        {children}
      </div>

      {/* ============ scroll hint ============ */}
      <div className="flex flex-col items-center gap-1 py-2 text-zinc-500">
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase">{scrollHint ?? 'scroll — the quilt is underneath'}</span>
        <span className="animate-bounce text-lg leading-none">↓</span>
      </div>

      {/* ============ BOTTOM: the living quilt ============ */}
      <div className="rounded-2xl border border-fuchsia-900/40 bg-[#0a0612]/80 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-fuchsia-200">functional quilt layers</h3>
            <p className="text-sm text-zinc-400">
              real-time values · tick {snap.tick} · the same run you are watching above
            </p>
          </div>
          {/* call economy strip */}
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
            <span className="text-fuchsia-300">
              quilt calls <span className="text-xl font-bold tabular-nums">{o.calls}</span>
            </span>
            <span className="text-emerald-300">
              internalized <span className="text-xl font-bold tabular-nums">{o.learned}</span>
            </span>
            <span className="flex items-center gap-2 text-zinc-400">
              confidence
              <span className="relative inline-block h-2 w-24 overflow-hidden rounded-full bg-zinc-800">
                <span
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-fuchsia-400 transition-all duration-500"
                  style={{ width: `${Math.round(o.confidence * 100)}%` }}
                />
              </span>
              <span className="tabular-nums">{Math.round(o.confidence * 100)}%</span>
            </span>
          </div>
        </div>

        {/* decomposer banner */}
        {d.awake && (
          <div className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3">
            <p className="font-mono text-sm font-bold tracking-widest text-amber-300 uppercase">
              ◈ the decomposer is awake — wake #{d.wakeCount}
            </p>
            <p className="mt-1 text-sm text-amber-200/90">
              stuck on: {d.reason}. The slow big agent decomposes what the fast cells couldn&apos;t —
              each adjustment leaves the quilt needing fewer calls than before.
            </p>
          </div>
        )}

        {/* cell layers */}
        <div className="space-y-4">
          {layers.map((layer) => (
            <div key={layer.label}>
              <div className="mb-1.5 flex items-baseline gap-3">
                <h4 className="font-mono text-xs font-semibold tracking-widest text-zinc-300 uppercase">{layer.label}</h4>
                <span className="text-xs text-zinc-500">{layer.blurb}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {layer.cellIds.map((id) => {
                  const cell = snap.cells.find((c) => c.id === id);
                  if (!cell) return null;
                  return <CellCard key={id} cell={cell} />;
                })}
              </div>
            </div>
          ))}
        </div>

        {/* event feed */}
        <div className="mt-5">
          <h4 className="mb-1.5 font-mono text-xs font-semibold tracking-widest text-zinc-300 uppercase">run log — rewindable truth</h4>
          <div
            ref={feedRef}
            className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-black/50 p-3 font-mono text-xs"
          >
            {feed.length === 0 && <p className="text-zinc-600">…no events yet — play the game above and watch this fill.</p>}
            {feed.map((f) => (
              <p key={f.id} className={FEED_STYLE[f.kind]}>
                <span className="text-zinc-600">t{snap.tick.toString().padStart(5, '0')} </span>
                {f.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
