'use client';

/*
 * MELON-SANDBOX — Tier 2 puzzle studio (the curious hands).
 *
 * Agentic sandbox in the melon-farm tradition: a little agent drops into
 * a RANDOMLY GENERATED world with a RANDOMLY GENERATED brain — three
 * visible op slots between its sensor cell and its action cell. Most
 * random brains fail hilariously. That is the lesson: behavior lives in
 * the wiring, not the creature.
 *
 * The player rewires op slots, rewinds to the start, replays, breaks it
 * on purpose, and generates something cool. Every run shows the sense
 * cell and each op slot lighting up as it fires — a quilt you can hold.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------- world ----------
const GW = 9;
const GH = 6;
type Tile = 'grass' | 'rock' | 'melon';
interface World { tiles: Tile[]; start: number; startDir: 0 | 1 | 2 | 3 }
// dir: 0=right 1=down 2=left 3=up

interface Brain {
  onWall: 'turnR' | 'turnL' | 'turnAround';
  onMelon: 'step' | 'party';
  onClear: 'step' | 'turnL' | 'turnR' | 'toward';
}

interface RunState {
  pos: number; dir: 0 | 1 | 2 | 3; steps: number;
  status: 'ready' | 'running' | 'won' | 'stuck';
  lastSense: 'wall' | 'melon' | 'clear' | '—';
  fired: [boolean, boolean, boolean];
  path: number[];
}

const OPS: Record<string, string> = {
  turnR: 'turn right', turnL: 'turn left', turnAround: 'turn around',
  step: 'step forward', party: 'step + celebrate', toward: 'drift toward melon',
};

const CHALLENGES = [
  { id: 'win',  text: 'Reach the melon in 14 steps or fewer.' },
  { id: 'spin', text: 'Break it on purpose: make it spin in place forever.' },
  { id: 'nol',  text: 'Reach the melon without ever turning left.' },
  { id: 'wild', text: 'Generate something cool — then make THAT brain win.' },
];

function genWorld(): World {
  const tiles: Tile[] = new Array(GW * GH).fill('grass');
  // border rocks
  for (let x = 0; x < GW; x++) { tiles[x] = 'rock'; tiles[(GH - 1) * GW + x] = 'rock'; }
  for (let y = 0; y < GH; y++) { tiles[y * GW] = 'rock'; tiles[y * GW + GW - 1] = 'rock'; }
  // interior scatter
  const inner: number[] = [];
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) inner.push(y * GW + x);
  for (const i of inner) if (Math.random() < 0.16) tiles[i] = 'rock';
  const open = inner.filter((i) => tiles[i] === 'grass');
  const melonAt = open[Math.floor(Math.random() * open.length)];
  tiles[melonAt] = 'melon';
  let start = open[Math.floor(Math.random() * open.length)];
  while (start === melonAt) start = open[Math.floor(Math.random() * open.length)];
  const dirs: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];
  return { tiles, start, startDir: dirs[Math.floor(Math.random() * 4)] };
}

function genBrain(): Brain {
  const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  return {
    onWall: pick(['turnR', 'turnL', 'turnAround'] as const),
    onMelon: pick(['step', 'party'] as const),
    onClear: pick(['step', 'turnL', 'turnR', 'toward'] as const),
  };
}

const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export default function MelonSandbox() {
  const [world, setWorld] = useState<World>(genWorld);
  const [brain, setBrain] = useState<Brain>(genBrain);
  const initRun: RunState = { pos: 0, dir: 0, steps: 0, status: 'ready', lastSense: '—', fired: [false, false, false], path: [] };
  const [run, setRun] = useState<RunState>(initRun);
  const runRef = useRef<RunState>(initRun);       // authoritative mutable mirror
  const [playing, setPlaying] = useState(false);
  const [challenge, setChallenge] = useState(0);
  const [wins, setWins] = useState(0);
  const snapshot = useRef<{ world: World; brain: Brain } | null>(null);

  const rewind = useCallback(() => {
    const snap = snapshot.current ?? { world, brain };
    setWorld(snap.world); setBrain(snap.brain);
    const r: RunState = { pos: snap.world.start, dir: snap.world.startDir, steps: 0, status: 'ready', lastSense: '—', fired: [false, false, false], path: [] };
    runRef.current = r;
    setRun(r);
    setPlaying(false);
  }, [world, brain]);

  const begin = useCallback(() => {
    snapshot.current = JSON.parse(JSON.stringify({ world, brain }));
    const r: RunState = { pos: world.start, dir: world.startDir, steps: 0, status: 'running', lastSense: '—', fired: [false, false, false], path: [world.start] };
    runRef.current = r;
    setRun(r);
    setPlaying(true);
  }, [world, brain]);

  // one tick of the run — mutates runRef (authoritative), then mirrors to React
  const step = useCallback(() => {
    const r0 = runRef.current;
    if (r0.status !== 'running') return;
    let { pos, dir } = r0;
    const fired: [boolean, boolean, boolean] = [false, false, false];
    let sense: RunState['lastSense'] = 'clear';
    const path = [...r0.path];
    const t = world.tiles[r0.pos];
    if (t === 'melon') {
      fired[1] = true; sense = 'melon';
      runRef.current = { ...r0, steps: r0.steps + 1, status: 'won', lastSense: 'melon', fired, path };
      setRun(runRef.current);
      setPlaying(false);
      return;
    }
    const [dx, dy] = DIRS[dir];
    const nx = pos + dx + dy * GW;
    const ahead = world.tiles[nx];
    if (ahead === 'rock') {
      fired[0] = true; sense = 'wall';
      dir = (brain.onWall === 'turnR' ? (dir + 1) : brain.onWall === 'turnL' ? (dir + 3) : (dir + 2)) % 4;
    } else {
      fired[2] = true;
      if (brain.onClear === 'step') pos = nx;
      else if (brain.onClear === 'turnL') dir = (dir + 3) % 4;
      else if (brain.onClear === 'turnR') dir = (dir + 1) % 4;
      else {
        const mi = world.tiles.findIndex((x) => x === 'melon');
        const mx = mi % GW, my = Math.floor(mi / GW);
        const px = pos % GW, py = Math.floor(pos / GW);
        if (my < py) dir = 3; else if (my > py) dir = 1;
        else if (mx > px) dir = 0; else if (mx < px) dir = 2;
        pos = nx;
      }
    }
    const steps = r0.steps + 1;
    path.push(pos);
    const status: RunState['status'] = steps >= 40 ? 'stuck' : 'running';
    runRef.current = { pos, dir: dir as 0 | 1 | 2 | 3, steps, status, lastSense: sense, fired, path };
    setRun(runRef.current);
    if (status === 'stuck') setPlaying(false);
  }, [world, brain]);

  useEffect(() => {
    if (!playing || run.status !== 'running') return;
    const t = setInterval(() => {
      step();
      if (runRef.current.status === 'won') {
        setWins((w) => w + 1);
        setPlaying(false);
      }
    }, 420);
    return () => clearInterval(t);
  }, [playing, run.status, step]);

  const cycle = (slot: keyof Brain) => {
    const orders: Record<keyof Brain, Brain[keyof Brain][]> = {
      onWall: ['turnR', 'turnL', 'turnAround'],
      onMelon: ['step', 'party'],
      onClear: ['step', 'turnL', 'turnR', 'toward'],
    };
    const list = orders[slot];
    const next = list[(list.indexOf(brain[slot]) + 1) % list.length];
    setBrain((b) => ({ ...b, [slot]: next }));
  };

  const cellClass = (fired: boolean, kind: 'sense' | 'op') =>
    `rounded-xl border p-3 text-left transition ${fired
      ? kind === 'sense' ? 'border-emerald-400 bg-emerald-950 shadow-[0_0_16px_-2px_rgba(52,211,153,0.6)]' : 'border-fuchsia-400 bg-fuchsia-950 shadow-[0_0_16px_-2px_rgba(232,121,249,0.6)]'
      : 'border-zinc-800 bg-zinc-950'}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {/* challenge card */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-amber-400 uppercase">puzzle {challenge + 1} of {CHALLENGES.length}</p>
            <p className="text-sm font-semibold text-amber-100">{CHALLENGES[challenge].text}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setChallenge((c) => (c + 1) % CHALLENGES.length)}
              className="rounded-lg border border-amber-700/60 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/40">next puzzle →</button>
          </div>
        </div>

        {/* controls */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={begin} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200">▶ release the agent</button>
          <button onClick={rewind} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500">↺ rewind to start</button>
          <button onClick={() => { setWorld(genWorld()); setBrain(genBrain()); const r: RunState = { pos: 0, dir: 0, steps: 0, status: 'ready', lastSense: '—', fired: [false, false, false], path: [] }; runRef.current = r; setRun(r); setPlaying(false); }}
            className="rounded-lg border border-fuchsia-700 bg-fuchsia-950/50 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-900/50">✦ generate me something cool</button>
          <span className="ml-auto self-center font-mono text-xs text-zinc-500">melons earned: <span className="font-bold text-emerald-300">{wins}</span></span>
        </div>

        {/* the world */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#07090b] p-3">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${GW}, 1fr)` }}>
            {world.tiles.map((t, i) => {
              const agent = run.status === 'running' || run.status === 'won' || run.status === 'stuck' ? run.pos === i : world.start === i;
              const visited = run.path.includes(i) && t !== 'rock';
              return (
                <div key={i} className={`relative flex aspect-square items-center justify-center rounded-md text-lg transition-colors duration-200 sm:text-xl ${
                  t === 'rock' ? 'bg-zinc-800' : t === 'melon' ? 'bg-emerald-800/70' : visited ? 'bg-emerald-950/70' : 'bg-zinc-900/40'
                }`}>
                  {t === 'rock' && <span className="text-zinc-600">▲</span>}
                  {t === 'melon' && <span className="animate-pulse font-bold text-emerald-300">✿</span>}
                  {agent && (
                    <span
                      className={`absolute inset-0 flex items-center justify-center font-black transition-transform ${
                        run.status === 'won' ? 'text-emerald-300' : 'text-white'
                      }`}
                      style={{ transform: `rotate(${[0, 90, 180, 270][run.status === 'running' || run.status === 'won' || run.status === 'stuck' ? run.dir : world.startDir]}deg)` }}
                    >
                      ◗
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* status strip */}
          <div className="mt-2 flex items-center justify-between font-mono text-xs">
            <span className={run.status === 'won' ? 'font-bold text-emerald-300' : run.status === 'stuck' ? 'text-rose-400' : 'text-zinc-500'}>
              {run.status === 'ready' && 'agent waiting — press release'}
              {run.status === 'running' && `step ${run.steps}/40 — sensed: ${run.lastSense}`}
              {run.status === 'won' && `MELON EARNED in ${run.steps} steps — the quilt fed itself`}
              {run.status === 'stuck' && `stuck at step 40 — this brain needs new hops. rewind + rewire.`}
            </span>
            <span className="text-zinc-600">sense → ops → act, every beat</span>
          </div>
        </div>

        {/* the brain — live cell strip, clickable to rewire */}
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className={cellClass(run.fired[0] || run.lastSense !== '—', 'sense')}>
            <p className="font-mono text-[10px] tracking-widest text-emerald-300 uppercase">sense cell</p>
            <p className="mt-1 text-sm text-zinc-300">{run.lastSense === '—' ? 'waking…' : `sees ${run.lastSense} ahead`}</p>
          </div>
          <span className="hidden self-center text-zinc-600 sm:block">→</span>
          <button onClick={() => cycle('onWall')} className={cellClass(run.fired[0], 'op')}>
            <p className="font-mono text-[10px] tracking-widest text-fuchsia-300 uppercase">hop · when wall</p>
            <p className="mt-1 text-sm font-semibold text-white">{OPS[brain.onWall]} <span className="text-zinc-500">(tap to change)</span></p>
          </button>
          <button onClick={() => cycle('onClear')} className={cellClass(run.fired[2], 'op')}>
            <p className="font-mono text-[10px] tracking-widest text-fuchsia-300 uppercase">hop · when clear</p>
            <p className="mt-1 text-sm font-semibold text-white">{OPS[brain.onClear]} <span className="text-zinc-500">(tap to change)</span></p>
          </button>
          <button onClick={() => cycle('onMelon')} className={cellClass(run.fired[1], 'op')}>
            <p className="font-mono text-[10px] tracking-widest text-fuchsia-300 uppercase">hop · on melon</p>
            <p className="mt-1 text-sm font-semibold text-white">{OPS[brain.onMelon]} <span className="text-zinc-500">(tap to change)</span></p>
          </button>
        </div>
      </div>

      {/* side: how to play + why it matters */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <h3 className="mb-2 font-mono text-xs font-bold tracking-widest text-zinc-400 uppercase">the idea</h3>
          <p className="text-sm leading-relaxed text-zinc-300">
            The agent is dumb. Its brain is three hops. When it fails, nothing is wrong with the
            creature — the <em>wiring</em> is wrong. Change one hop, rewind, replay. That loop —
            watch, adjust, rewind, replay — is exactly how real quilt cells get tuned.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <h3 className="mb-2 font-mono text-xs font-bold tracking-widest text-zinc-400 uppercase">try this</h3>
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-zinc-300">
            <li>Release it as generated. Watch where it loops.</li>
            <li>Swap <span className="font-mono text-fuchsia-300">when clear</span> to <span className="text-white">step forward</span> and rewind.</li>
            <li>Now break it again: <span className="text-white">turn left</span> when clear. Spin forever.</li>
            <li>Generate something cool — can <em>you</em> tame a wild brain?</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-4">
          <p className="text-sm text-emerald-200">
            <span className="font-bold">Ah-ha ahead:</span> in the next studio you&apos;ll wire these
            hops yourself like tracks in a music maker — same cells, same hooks, your composition.
          </p>
        </div>
      </aside>
    </div>
  );
}
