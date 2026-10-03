'use client';

/*
 * THE NIGHT ENGINE — Rung VI · erised arrangements.
 *
 * The game-master loop, as a tool for thinking about stories:
 *   the GM crafts a world (world card: situation, tension, secret) —
 *   strong personalities arrive (six canon skins, each worn by a
 *   different live model) — the table improvises and the scene evolves —
 *   where ideas deadlock, a platonic roll moves the story — the GM plays
 *   a minor role (a cue every fourth beat, or full autopilot) —
 *   checkpoints are stable points; rewind APPENDS (scars survive) —
 *   the same seed replays honestly — refine the starting state and
 *   run it again — then mix: splice beats across runs, write repairs,
 *   and bind them into one night that reads as a single sitting.
 *
 * Every landing is a receipt {seq, op, who, payload, sticky, prev, tip}
 * on a sha256 chain — the mix pass is itself a valid chain. The dice are
 * pure functions of the ledger: citable forever, even unwound ones.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  NightLedger,
  buildMixedNight,
  type Beat,
  type RollReceipt,
} from '@/lib/night/ledger';
import { CAST, SEEDS, type SceneSeedDef } from '@/lib/night/cast';
import { QuiltEngine } from '@/lib/quilt/engine';
import QuiltXRay, { type CellLayerDef } from './QuiltXRay';

const ORDER = ['wesley', 'cook', 'crab', 'builder', 'finder', 'quartermaster'];
const CAST_BY_ID = Object.fromEntries(CAST.map((c) => [c.id, c]));

const GM_CUES = [
  'the coffee cools another degree.',
  'the red smear has not moved.',
  'somewhere below, a shell pinches.',
  '0400 passes. nobody wrote it down.',
  'the anchor holds. for now.',
  'the morning book waits, open.',
];

const OPPOSE = /(won'?t|will not|refuse|must|never|insist|demand|forbid|over my|cannot let)/i;

interface RunEntry {
  id: string;
  title: string;
  nightSeed: number;
  scene: { situation: string; tension: string; secret: string };
  ledger: NightLedger;
  closedAt: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function NightEngine() {
  // ---------- world card (the GM refines the starting state between runs) ----------
  const [seedIdx, setSeedIdx] = useState(0);
  const seedDef: SceneSeedDef = SEEDS[seedIdx];
  const [situation, setSituation] = useState(SEEDS[0].situation);
  const [tension, setTension] = useState(SEEDS[0].tension);
  const [secret, setSecret] = useState(SEEDS[0].secret);
  const [nightSeed, setNightSeed] = useState(() => Math.floor(Math.random() * 1_000_000));

  // ---------- ledger + mirrors ----------
  const ledgerRef = useRef<NightLedger | null>(null);
  const runsRef = useRef<Map<string, RunEntry>>(new Map());
  const wantsRef = useRef<{ who: string; want: string }[]>([]);
  const beatCountRef = useRef(0);
  const liveRef = useRef(true); // matches liveCast's initial state — the toggle keeps them in step
  const autoRef = useRef(false);
  const deadlockRef = useRef(false);
  const sceneRef = useRef({ title: seedDef.title, situation, tension, secret, solid: seedDef.solid, difficulty: seedDef.difficulty });

  const [view, setView] = useState<Beat[]>([]);
  const [chainLen, setChainLen] = useState(0);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [liveCast, setLiveCast] = useState(true);
  const [calls, setCalls] = useState({ live: 0, local: 0, understudy: 0 });
  const [lastRoll, setLastRoll] = useState<RollReceipt | null>(null);
  const [deadlock, setDeadlock] = useState(false);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [mixMode, setMixMode] = useState(false);
  const [mixPicks, setMixPicks] = useState<{ runId: string; seq: number; who: string; text: string; why: string }[]>([]);
  const [mixWhy, setMixWhy] = useState('the version of the line the night needed');
  const [repairs, setRepairs] = useState(
    'timeline | run B heard the entry at 0400, run A at 0522 | the entry is written at 0522; 0400 is when the kindness was decided | one night, one clock\nvoice | the crab spoke two sentences about the shell | keep the crab\u2019s second sentence | the hard turn is the payload',
  );
  const [mixOut, setMixOut] = useState<NightLedger | null>(null);

  // one engine for the same run the story shows — the one-engine claim, kept
  const [engine] = useState(() => new QuiltEngine([
    ...CAST.map((c) => ({ id: `char-${c.id}`, label: c.name, kind: c.kind })),
    { id: 'dice', label: 'PLATONIC·DIE', kind: 'value' as const },
    { id: 'ledger', label: 'RECEIPTS', kind: 'memory' as const },
    { id: 'scars', label: 'SCARS', kind: 'memory' as const },
    { id: 'calls', label: 'LIVE·CALLS', kind: 'plan' as const },
  ]));

  const LAYERS: CellLayerDef[] = useMemo(() => [
    { label: 'the cast as cells', blurb: 'six canon skins, each worn by a different live model — presence lights the cells', cellIds: CAST.map((c) => `char-${c.id}`) },
    { label: 'the platonic ledger', blurb: 'receipts on a sha256 chain; dice are pure functions of the chain; scars are sticky', cellIds: ['dice', 'ledger', 'scars'] },
    { label: 'the night call economy', blurb: 'live model calls vs local recordings vs understudy steps — every substitution booked, none hidden', cellIds: ['calls'] },
  ], []);

  const syncFromLedger = useCallback(() => {
    const led = ledgerRef.current;
    if (!led) return;
    const v = led.viewBeats();
    setView([...v]);
    setChainLen(led.beats.length);
    engine.set('ledger', led.beats.length, 'receipts');
    engine.set('scars', led.scars().length, 'sticky');
    const counts: Record<string, number> = {};
    for (const b of v) if (b.op === 'say') counts[b.who] = (counts[b.who] ?? 0) + 1;
    for (const c of CAST) engine.set(`char-${c.id}`, (counts[c.id] ?? 0) * 12, 'presence');
    beatCountRef.current = v.filter((b) => b.op === 'say').length;
  }, [engine]);

  // ---------- the night ----------
  const openNight = useCallback(() => {
    const scene = { title: seedDef.title, situation, tension, secret, solid: seedDef.solid, difficulty: seedDef.difficulty };
    sceneRef.current = scene;
    const led = new NightLedger(`night-${nightSeed}`);
    ledgerRef.current = led;
    wantsRef.current = [];
    setCalls({ live: 0, local: 0, understudy: 0 });
    setLastRoll(null);
    setMixOut(null);
    led.append('night.open', 'GM', `the GM sets the table — "${scene.title}" (night seed ${nightSeed}, citable)`, true);
    led.append('scene.enter', 'GM', `${scene.situation}`, true);
    led.append('scar', 'GM', `the secret the table does not know: ${scene.secret}`, true);
    syncFromLedger();
    setSceneOpen(true);
  }, [seedDef, situation, tension, secret, nightSeed, syncFromLedger]);

  const localLine = useCallback((who: string): { say: string; act: string; want: string } => {
    const lines = CAST_BY_ID[who]?.local ?? ['…'];
    const say = lines[beatCountRef.current % lines.length];
    return { say, act: 'holds their post', want: 'to be understood' };
  }, []);

  const landBeat = useCallback((who: string, resp: { say: string; act: string; want: string }) => {
    const led = ledgerRef.current;
    if (!led) return;
    led.append('say', who, resp.say);
    led.append('act', who, `${resp.act} ‹want: ${resp.want}›`);
    wantsRef.current = [...wantsRef.current, { who, want: resp.want }].slice(-6);
    // deadlock sensing: two consecutive wants with no shared ground and a hard verb
    const w = wantsRef.current;
    if (w.length >= 2) {
      const a = w[w.length - 2];
      const b = w[w.length - 1];
      const wordsOf = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter((x) => x.length > 3));
      const stuck = a && b && a.who !== b.who
        ? [...wordsOf(a.want)].filter((x) => wordsOf(b.want).has(x)).length === 0
          && (OPPOSE.test(a.want) || OPPOSE.test(b.want))
        : false;
      deadlockRef.current = stuck;
      setDeadlock(stuck);
    }
    // GM plays a minor role: a cue every fourth beat
    if (beatCountRef.current > 0 && beatCountRef.current % 4 === 3) {
      led.append('act', 'GM', GM_CUES[beatCountRef.current % GM_CUES.length]);
    }
    syncFromLedger();
  }, [syncFromLedger]);

  const playBeat = useCallback(async (): Promise<void> => {
    const led = ledgerRef.current;
    if (!led || busy) return;
    setBusy(true);
    engine.step();
    try {
      const who = ORDER[beatCountRef.current % ORDER.length];
      const member = CAST_BY_ID[who];
      const transcript = led.viewBeats().filter((b) => b.op === 'say' || b.op === 'act')
        .map((b) => `${(b.who === 'GM' ? 'GM' : CAST_BY_ID[b.who]?.name ?? b.who)} ${b.op === 'say' ? 'says' : 'does'}: ${b.payload}`);
      let resp: { say: string; act: string; want: string } | null = null;
      let understudy = false;
      if (liveRef.current) {
        try {
          const r = await fetch('/api/night-cast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              castId: who,
              scene: { title: sceneRef.current.title, situation: sceneRef.current.situation, tension: sceneRef.current.tension, secret: sceneRef.current.secret },
              transcript,
              cue: beatCountRef.current === 0 ? 'You open the night. Everyone can hear you.' : undefined,
            }),
          });
          const d = await r.json();
          if (d.ok && d.say) {
            resp = { say: d.say, act: d.act ?? 'holds their post', want: d.want ?? 'to be understood' };
            understudy = !!d.understudy;
          }
        } catch { /* fall through to the recording */ }
      }
      if (resp) {
        setCalls((c) => ({ live: c.live + 1, local: c.local, understudy: c.understudy + (understudy ? 1 : 0) }));
        engine.set('calls', engine.get('calls') + 1, understudy ? 'understudy' : 'live');
      } else {
        resp = localLine(who);
        setCalls((c) => ({ live: c.live, local: c.local + 1, understudy: c.understudy }));
      }
      landBeat(who, resp);
    } finally {
      setBusy(false);
    }
  }, [busy, engine, localLine, landBeat]);

  // deadlock sensing lives in landBeat (state + ref) — the dice move the
  // story instead of logic hashed to death

  const callRoll = useCallback((why: string, roller = 'TABLE') => {
    const led = ledgerRef.current;
    if (!led) return;
    const { receipt } = led.roll(roller, sceneRef.current.solid, 1, why);
    setLastRoll(receipt);
    engine.set('dice', receipt.sum, 'platonic');
    const failed = receipt.sum < sceneRef.current.difficulty;
    if (failed) {
      const pick = receipt.sum % 3;
      const kind = pick === 0 ? 'COST' : pick === 1 ? 'OBSTACLE' : 'REVEAL';
      const lines: Record<string, string> = {
        COST: 'something true gets logged that stings — the cost is booked as a scar and survives any rewind',
        OBSTACLE: 'the situation worsens honestly: the morning book closes on its own terms now, not the table\u2019s',
        REVEAL: 'an uncomfortable fact surfaces: the kindness in the entry has an author, and the author is at this table',
      };
      led.append('scar', 'GM', `die says ${receipt.sum} < ${sceneRef.current.difficulty} — ${kind}: ${lines[kind]} (seed ${receipt.seed})`, true);
    } else {
      led.append('act', 'GM', `die says ${receipt.sum} ≥ ${sceneRef.current.difficulty} — the story moves; luck is on the side of whoever spoke last (seed ${receipt.seed})`);
    }
    syncFromLedger();
  }, [engine, syncFromLedger]);

  const bookScar = useCallback((beat: Beat) => {
    const led = ledgerRef.current;
    if (!led) return;
    led.append('scar', beat.who, `${beat.payload} (booked from #${beat.seq} — sticky, survives rewind)`, true);
    syncFromLedger();
  }, [syncFromLedger]);

  const checkpoint = useCallback(() => {
    const led = ledgerRef.current;
    if (!led) return;
    led.append('checkpoint', 'GM', `stable point — ${led.viewBeats().filter((b) => b.op === 'say').length} beats spoken`, true);
    syncFromLedger();
  }, [syncFromLedger]);

  const checkpoints = useMemo(
    () => view.filter((b) => b.op === 'checkpoint').map((b) => ({ seq: b.seq, text: b.payload })),
    [view],
  );

  const rewindTo = useCallback((seq: number) => {
    const led = ledgerRef.current;
    if (!led) return;
    led.rewind(seq, `the GM rewinds to the stable point #${seq} to refine the night — unwound beats stay in the ledger, scars stay in the story`);
    setLastRoll(null);
    syncFromLedger();
  }, [syncFromLedger]);

  const closeNight = useCallback(() => {
    const led = ledgerRef.current;
    if (!led) return;
    led.append('scene.leave', 'GM', 'the scene plays itself out', false);
    led.append('checkpoint', 'GM', 'scene close — stable point', true);
    led.append('night.close', 'GM', `the night stands: ${led.beats.length} receipts, ${led.scars().length} scars, chain ${led.verify().ok ? 'verified' : 'BROKEN'}`, true);
    syncFromLedger();
    const entry: RunEntry = {
      id: `night-${nightSeed}-${runsRef.current.size + 1}`,
      title: sceneRef.current.title,
      nightSeed,
      scene: { situation: sceneRef.current.situation, tension: sceneRef.current.tension, secret: sceneRef.current.secret },
      ledger: led,
      closedAt: Date.now(),
    };
    runsRef.current.set(entry.id, entry);
    setRuns((rs) => [...rs, entry]);
    setSceneOpen(false);
    setAuto(false);
    autoRef.current = false;
  }, [nightSeed, syncFromLedger]);

  const runAutopilot = useCallback(async () => {
    if (autoRef.current) { autoRef.current = false; setAuto(false); return; }
    autoRef.current = true;
    setAuto(true);
    while (autoRef.current && ledgerRef.current && beatCountRef.current < 12) {
      await playBeat();
      if (deadlockRef.current) {
        deadlockRef.current = false;
        callRoll('the table deadlocks — the dice move the story');
      }
      await sleep(500);
    }
    autoRef.current = false;
    setAuto(false);
  }, [playBeat, callRoll]);

  // ---------- the mix pass ----------
  const togglePick = useCallback((runId: string, b: Beat) => {
    if (b.op !== 'say') return;
    setMixPicks((ps) => {
      const has = ps.some((p) => p.runId === runId && p.seq === b.seq);
      if (has) return ps.filter((p) => !(p.runId === runId && p.seq === b.seq));
      return [...ps, { runId, seq: b.seq, who: b.who, text: b.payload, why: mixWhy }];
    });
  }, [mixWhy]);

  const bindOneNight = useCallback(() => {
    const sources = runs.map((r) => ({ runId: r.id, ledger: r.ledger }));
    if (sources.length === 0) return;
    const parsedRepairs = repairs.split('\n').filter((l) => l.trim()).map((l) => {
      const [kind, before, after, why] = l.split('|').map((s) => s.trim());
      return { kind: (['continuity', 'voice', 'timeline'].includes(kind) ? kind : 'continuity') as 'continuity' | 'voice' | 'timeline', before: before ?? '', after: after ?? '', why: why ?? '' };
    });
    const ordered = [...mixPicks].sort((a, b) => {
      const orderOf = (p: typeof a) => runs.findIndex((r) => r.id === p.runId);
      return orderOf(a) - orderOf(b);
    });
    const mix = buildMixedNight(
      `mixed-night-${Date.now()}`,
      sources,
      ordered.map((p) => ({ runId: p.runId, seq: p.seq, why: p.why })),
      parsedRepairs,
    );
    setMixOut(mix);
  }, [runs, mixPicks, repairs]);

  const mixPicksByRun = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of mixPicks) m.set(p.runId, (m.get(p.runId) ?? 0) + 1);
    return m;
  }, [mixPicks]);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-xs text-zinc-400">
          <span className="mr-3 rounded border border-amber-800 bg-amber-950/40 px-2 py-1 text-amber-300">night seed {nightSeed} — citable</span>
          <span className="mr-3">receipts: <span className="text-cyan-300">{chainLen}</span></span>
          <span>calls: <span className="text-fuchsia-300">{calls.live}</span> live · <span className="text-zinc-400">{calls.local}</span> local · <span className="text-rose-300">{calls.understudy}</span> understudy</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { liveRef.current = !liveCast; setLiveCast(!liveCast); }}
            title="each beat takes ONE real model call — the character's own skin, server-side keyed"
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              liveCast ? 'border border-fuchsia-500 bg-fuchsia-950/60 text-fuchsia-200' : 'border border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            {liveCast ? '● live cast: on' : '○ live cast: off'}
          </button>
        </div>
      </div>

      {/* the world card — the GM crafts, refines, re-runs */}
      <div className="rounded-2xl border border-amber-900/50 bg-[radial-gradient(ellipse_at_top,#1a1206,#07090b)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {SEEDS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setSeedIdx(i); setSituation(s.situation); setTension(s.tension); setSecret(s.secret); }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                seedIdx === i ? 'bg-amber-400 text-black' : 'border border-amber-800 text-amber-300 hover:border-amber-500'
              }`}
            >
              {s.title}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] tracking-widest text-zinc-500 uppercase">the GM\u2019s world card — refine it between runs</span>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <label className="block">
            <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">situation</span>
            <textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={4}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/50 p-2 text-xs text-zinc-300" />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">tension (what collides)</span>
            <textarea value={tension} onChange={(e) => setTension(e.target.value)} rows={4}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/50 p-2 text-xs text-zinc-300" />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">secret (the dice may surface it)</span>
            <textarea value={secret} onChange={(e) => setSecret(e.target.value)} rows={4}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/50 p-2 text-xs text-zinc-300" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={openNight} disabled={sceneOpen}
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:bg-zinc-200 disabled:opacity-40">
            ◆ open the night
          </button>
          <button onClick={() => setNightSeed(Math.floor(Math.random() * 1_000_000))}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500">
            re-seed
          </button>
          <span className="self-center text-xs text-zinc-500">same seed + same card = the night replays honestly; change the card and the run diverges — that is the refine loop</span>
        </div>
      </div>

      {/* the cast */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {CAST.map((c) => (
          <div key={c.id} className={`rounded-xl border bg-zinc-950 p-2.5 ${c.color} border-current/40`}>
            <p className="font-mono text-xs font-black tracking-wider">{c.name}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">{c.role}</p>
            <p className="mt-1 truncate font-mono text-[9px] text-zinc-600" title={`${c.provider}:${c.model}`}>skin: {c.model.split('/').pop()}</p>
          </div>
        ))}
      </div>

      {/* the table */}
      <div className="rounded-2xl border border-zinc-800 bg-[radial-gradient(ellipse_at_top,#120b1e,#07090b)] p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => playBeat()} disabled={!sceneOpen || busy || auto}
                className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
                ▸ play a beat
              </button>
              <button onClick={runAutopilot} disabled={!sceneOpen}
                className={`rounded-lg px-4 py-2 text-sm font-semibold border disabled:opacity-40 ${auto ? 'border-fuchsia-500 bg-fuchsia-950/60 text-fuchsia-200' : 'border-zinc-700 text-zinc-200 hover:border-zinc-500'}`}>
                {auto ? '■ stop the autopilot' : '⏵ let it play on autopilot'}
              </button>
              <button onClick={() => callRoll(deadlock ? 'the table deadlocks — the dice move the story' : 'the GM calls for the roll')}
                disabled={!sceneOpen || busy}
                className="rounded-lg border border-fuchsia-700 px-4 py-2 text-sm text-fuchsia-300 hover:border-fuchsia-500 disabled:opacity-40">
                🎲 roll for it
              </button>
              <button onClick={checkpoint} disabled={!sceneOpen}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-40">
                ◈ checkpoint
              </button>
              <button onClick={closeNight} disabled={!sceneOpen}
                className="rounded-lg border border-emerald-700 px-4 py-2 text-sm text-emerald-300 hover:border-emerald-500 disabled:opacity-40">
                ✓ close the night
              </button>
            </div>
            {deadlock && sceneOpen && (
              <p className="mt-2 font-mono text-xs text-amber-300">⚠ deadlock sensed — the last two wants share no ground. roll for it, or let the autopilot roll for you.</p>
            )}
            {lastRoll && (
              <p className="mt-3 font-mono text-sm text-fuchsia-300">
                last die: <span className="text-2xl font-black">{lastRoll.sum}</span>
                <span className="ml-2 text-xs text-zinc-500">({lastRoll.solid} · seed {lastRoll.seed} · {lastRoll.why})</span>
              </p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              {seedDef.title}: the cast improvises in seating order. Where wants deadlock, the platonic die moves the story — a failed roll books a
              {' '}<span className="text-rose-300">cost</span>, <span className="text-rose-300">obstacle</span>, or <span className="text-rose-300">reveal</span> as a{' '}
              <span className="text-amber-300">scar</span> that survives rewind. Rewind to any checkpoint to refine the night; unwound beats stay in the ledger.
            </p>
          </div>

          {/* the scene log — the rewindable greater scene */}
          <div className="rounded-xl border border-zinc-800 bg-black/50 p-3">
            <p className="mb-2 font-mono text-[10px] tracking-widest text-zinc-500 uppercase">the night — append-only, rewindable</p>
            <div className="max-h-80 space-y-1.5 overflow-y-auto font-mono text-xs">
              {view.length === 0 && <p className="text-zinc-600">the table is dark. open the night.</p>}
              {view.map((b) => {
                const name = b.who === 'GM' ? 'GM' : b.who === 'MIX' ? 'MIX' : CAST_BY_ID[b.who]?.name ?? b.who;
                const color = b.op === 'scar' ? 'text-amber-300' : b.op === 'roll' ? 'text-fuchsia-300'
                  : b.op === 'rewind' ? 'text-sky-300 font-bold' : b.op === 'checkpoint' ? 'text-zinc-500'
                  : b.op === 'say' ? (CAST_BY_ID[b.who]?.color ?? 'text-zinc-300') : 'text-zinc-400';
                return (
                  <div key={b.seq} className="group">
                    <p className={color}>
                      <span className="mr-1 text-[10px] text-zinc-600">#{b.seq}</span>
                      {b.op === 'say' ? <span className="font-bold">{name}: </span> : <span className="text-[10px] uppercase tracking-wider">{b.op} · {name} · </span>}
                      {b.payload.length > 220 ? b.payload.slice(0, 220) + '…' : b.payload}
                    </p>
                    <p className="hidden text-[9px] text-zinc-700 group-hover:block">tip {b.tip.slice(0, 24)}…</p>
                    {b.op === 'say' && sceneOpen && !auto && (
                      <button onClick={() => bookScar(b)} className="hidden text-[9px] text-amber-500 hover:text-amber-300 group-hover:inline">book this as a scar</button>
                    )}
                  </div>
                );
              })}
            </div>
            {checkpoints.length > 0 && sceneOpen && (
              <div className="mt-2 border-t border-zinc-800 pt-2">
                <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">rewind to a stable point</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {checkpoints.map((cp) => (
                    <button key={cp.seq} onClick={() => rewindTo(cp.seq)}
                      className="rounded border border-sky-800 px-2 py-1 text-[10px] text-sky-300 hover:border-sky-500">
                      ↺ #{cp.seq}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* runs shelf + mix pass */}
      <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">runs shelf — play-throughs kept, never deleted ({runs.length})</p>
          {runs.length > 0 && (
            <button onClick={() => { setMixMode(!mixMode); setMixPicks([]); setMixOut(null); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${mixMode ? 'bg-white text-black' : 'border border-zinc-700 text-zinc-300'}`}>
              {mixMode ? '✓ mixing' : 'mix a one-night cut'}
            </button>
          )}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {runs.map((r) => (
            <div key={r.id} className={`rounded-xl border p-3 ${mixPicksByRun.get(r.id) ? 'border-emerald-600 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-950'}`}>
              <p className="font-mono text-xs font-bold text-zinc-200">{r.id}</p>
              <p className="text-[10px] text-zinc-500">&ldquo;{r.title}&rdquo; · seed {r.nightSeed} · {r.ledger.beats.length} receipts · {r.ledger.scars().length} scars</p>
              <p className="mt-1 line-clamp-2 text-[10px] text-zinc-600">{r.scene.tension}</p>
            </div>
          ))}
          {runs.length === 0 && <p className="text-xs text-zinc-600">close a night and it lands here. run it again with a refined card. mix the best of both.</p>}
        </div>

        {mixMode && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">splice — pick spoken beats from each run</p>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                {runs.map((r) => (
                  <div key={r.id}>
                    <p className="font-mono text-[10px] text-zinc-400">{r.id} — spoken beats</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.ledger.viewBeats().filter((b) => b.op === 'say').map((b) => {
                        const picked = mixPicks.some((p) => p.runId === r.id && p.seq === b.seq);
                        return (
                          <button key={b.seq} onClick={() => togglePick(r.id, b)}
                            className={`rounded border px-1.5 py-0.5 text-[10px] ${picked ? 'border-emerald-500 bg-emerald-900/40 text-emerald-200' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                            title={b.payload.slice(0, 120)}>
                            #{b.seq} {CAST_BY_ID[b.who]?.name ?? b.who}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <label className="mt-2 block">
                <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">why this splice (applies to the next pick)</span>
                <input value={mixWhy} onChange={(e) => setMixWhy(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/50 p-2 text-xs text-zinc-300" />
              </label>
            </div>
            <div>
              <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">repairs — continuity | voice | timeline (one per line: kind | before | after | why)</span>
              <textarea value={repairs} onChange={(e) => setRepairs(e.target.value)} rows={5}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/50 p-2 font-mono text-[10px] text-zinc-300" />
              <button onClick={bindOneNight} disabled={mixPicks.length === 0}
                className="mt-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:bg-zinc-200 disabled:opacity-40">
                ⧉ bind the one night ({mixPicks.length} beats)
              </button>
            </div>
          </div>
        )}

        {mixOut && (
          <div className="mt-4 rounded-xl border border-emerald-700/60 bg-emerald-950/10 p-4">
            <p className="font-mono text-xs font-bold tracking-widest text-emerald-300 uppercase">
              the one night — {mixOut.beats.length} receipts · chain {mixOut.verify().ok ? 'verified ✓' : 'BROKEN'}
            </p>
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto font-mono text-xs">
              {mixOut.viewBeats().map((b) => (
                <p key={b.seq} className="text-zinc-300">
                  <span className="mr-1 text-[10px] text-zinc-600">#{b.seq}</span>
                  <span className={b.op === 'splice' ? (CAST_BY_ID[b.who]?.color ?? 'text-zinc-300') : 'text-amber-300'}>
                    {b.op === 'splice' ? `${(CAST_BY_ID[b.who]?.name ?? b.who)}: ` : `${b.op}: `}
                  </span>
                  {b.payload}
                </p>
              ))}
            </div>
            <p className="mt-2 text-xs text-emerald-200/70">
              splices carry their provenance ⟨from run·seq⟩; repairs are sticky. The night reads as one sitting — and the chain still verifies.
            </p>
          </div>
        )}
      </div>

      <QuiltXRay
        engine={engine}
        layers={LAYERS}
        simTitle="The night, and the receipts underneath it"
        simBlurb="a story on top — a sha256 ledger, platonic dice and a call economy underneath"
      >
        <p className="rounded-xl border border-zinc-800 bg-black/40 p-4 text-sm leading-relaxed text-zinc-300">
          Every landing is a receipt: <span className="font-mono text-cyan-300">{`{seq, op, who, payload, sticky, prev, tip}`}</span>, hashed into the
          chain. The die is a pure function of the chain — same ledger, same roll, citable forever, even for unwound beats. Rewind appends; scars
          persist; the mix pass is itself a valid chain. And the cast is not one model imagining six voices — it is five real models wearing six
          canon skins, with every substitution booked. That is the whole tool: craft a world, let strong characters evolve it, let the dice move
          deadlocks, rewind, refine the card, run again, and splice the runs into one night.
        </p>
      </QuiltXRay>
    </div>
  );
}
