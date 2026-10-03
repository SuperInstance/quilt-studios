'use client';

/*
 * THE DUNGEON — Rung V · all ages at once.
 *
 * The party IS a quilt: each character is a cell, each bond is a hook,
 * the GM is the decomposer who only speaks when the party is stuck.
 * Younger players feel a story; professionals recognize orchestrated
 * agents with receipts.
 *
 * Platonic randomness: every roll comes from a seeded geometric PRNG
 * (mulberry32). The seed is printed on the scene — same seed, same dice,
 * rewound scenes replay honestly. Randomness is the mortar: kids trust
 * the generator, pros can cite the seed.
 *
 * The GM (decomposer): two failures in a room wake the slow big narrator.
 * It decomposes the stuck room into what each cell knew and suggests one
 * re-wiring (a new bond). Applying it changes the wiring, then the scene
 * can be rewound to the last camp and replayed — granularly changed and
 * spun back up from a different point.
 */

import { useCallback, useMemo, useState } from 'react';
import { QuiltEngine } from '@/lib/quilt/engine';
import QuiltXRay, { type CellLayerDef } from './QuiltXRay';

// ---------- platonic randomness (seeded, honest, citable) ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const d20 = (rng: () => number) => 1 + Math.floor(rng() * 20);

// ---------- the party as cells ----------
interface Char {
  id: string; name: string; role: string; kind: 'sensor' | 'action' | 'memory' | 'plan';
  charge: number; // 0..100
}
const PARTY: Char[] = [
  { id: 'maple', name: 'MAPLE', role: 'the Ranger — scouts ahead', kind: 'sensor', charge: 100 },
  { id: 'borin', name: 'BORIN', role: 'the Fighter — blocks and strikes', kind: 'action', charge: 100 },
  { id: 'wren',  name: 'WREN',  role: 'the Trickster — remembers traps', kind: 'memory', charge: 100 },
  { id: 'sol',   name: 'SOL',   role: 'the Oracle — asks the GM', kind: 'plan', charge: 100 },
];

interface Room { name: string; kind: 'guardian' | 'trap' | 'riddle' | 'treasure' | 'boss'; difficulty: number; blurb: string; camp?: boolean }

const ROOM_NAMES: Room[] = [
  { name: 'The Mossy Gate',   kind: 'guardian', difficulty: 11, blurb: 'Something big breathes behind the moss.' },
  { name: 'The Ticking Hall', kind: 'trap',     difficulty: 10, blurb: 'Floor tiles remember where feet step.' },
  { name: 'The Quiet Camp',   kind: 'treasure', difficulty: 5,  blurb: 'A safe fire. A stable point in the dark.', camp: true },
  { name: 'The Mirror Riddle',kind: 'riddle',   difficulty: 12, blurb: 'A question that only answers itself twice.' },
  { name: 'The Hoard Vault',  kind: 'treasure', difficulty: 9,  blurb: 'Gold, and the hush of something watching.' },
  { name: 'The Second Camp',  kind: 'treasure', difficulty: 5,  blurb: 'One more fire before the deep.', camp: true },
  { name: 'The Dungeon Heart',kind: 'boss',     difficulty: 14, blurb: 'The room that decomposes parties.' },
];

const KIND_COLOR: Record<Char['kind'], string> = {
  sensor: 'text-emerald-300 border-emerald-500/60',
  action: 'text-rose-300 border-rose-500/60',
  memory: 'text-cyan-300 border-cyan-500/60',
  plan: 'text-fuchsia-300 border-fuchsia-500/60',
};

interface SceneLog { t: number; text: string; cls: string }

const SUGGESTIONS = [
  { bond: ['wren', 'borin'], text: 'Bond WREN to BORIN — the trap memory should inform the block.' },
  { bond: ['maple', 'sol'],  text: 'Bond MAPLE to SOL — the scout\'s senses should feed the oracle\'s questions.' },
  { bond: ['borin', 'wren'], text: 'Bond BORIN to WREN — protection buys the trickster time to think.' },
  { bond: ['sol', 'borin'],  text: 'Bond SOL to BORIN — the oracle\'s plan should reach the sword.' },
];

export default function TheDungeon() {
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [turn, setTurn] = useState(0);
  const [roomIdx, setRoomIdx] = useState(0);
  const [charge, setCharge] = useState<Record<string, number>>({ maple: 100, borin: 100, wren: 100, sol: 100 });
  const [bonds, setBonds] = useState<{ a: string; b: string }[]>([{ a: 'maple', b: 'borin' }]);
  const [fails, setFails] = useState(0);
  const [log, setLog] = useState<SceneLog[]>([{ t: 0, text: `the party gathers at the gate — scene seed ${seed}`, cls: 'text-zinc-400' }]);
  const [gm, setGm] = useState<{ awake: boolean; suggestion: typeof SUGGESTIONS[number] | null; wakes: number; live: boolean }>({ awake: false, suggestion: null, wakes: 0, live: false });
  const [liveGm, setLiveGm] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [camps, setCamps] = useState<{ roomIdx: number; charge: Record<string, number>; turn: number }[]>([]);
  const [won, setWon] = useState(false);
  const [busy, setBusy] = useState(false);

  // one engine for the same run the story shows — the one-engine claim, kept
  const [engine] = useState(() => new QuiltEngine([
    { id: 'room-idx', label: 'ROOM', kind: 'value' },
    { id: 'd20', label: 'D20', kind: 'value' },
    { id: 'char-maple', label: 'MAPLE', kind: 'sensor' },
    { id: 'char-borin', label: 'BORIN', kind: 'action' },
    { id: 'char-wren', label: 'WREN', kind: 'memory' },
    { id: 'char-sol', label: 'SOL', kind: 'plan' },
    { id: 'bond-n', label: 'BONDS', kind: 'memory' },
    { id: 'gm', label: 'GM·WAKE', kind: 'plan' },
  ]));

  const LAYERS: CellLayerDef[] = [
    { label: 'the party as cells', blurb: 'each adventurer is a live cell — charge streams as they act', cellIds: ['char-maple', 'char-borin', 'char-wren', 'char-sol'] },
    { label: 'the world cells', blurb: 'which room, what the dice just said, how many bonds hold', cellIds: ['room-idx', 'd20', 'bond-n'] },
    { label: 'the GM cell', blurb: 'the decomposer\'s wake count — it only speaks when stuck', cellIds: ['gm'] },
  ];

  const pushLog = useCallback((text: string, cls: string) => {
    setLog((l) => [{ t: Date.now() % 100000, text, cls }, ...l].slice(0, 30));
  }, []);

  // rng seeded by seed+turn — deterministic, citable
  const rngFor = useCallback((t: number) => mulberry32(seed * 7919 + t * 104729), [seed]);

  const rollScene = useCallback(() => {
    if (busy || won) return;
    setBusy(true);
    const t = turn + 1;
    setTurn(t);
    engine.step();
    const room = ROOM_NAMES[roomIdx];
    const rng = rngFor(t);
    const bondsOf = (id: string) => bonds.filter((b) => b.a === id || b.b === id).length;

    // beat 1 — the sensor scouts
    const scout = d20(rng);
    const scoutKnows = room.kind === 'trap' || room.kind === 'riddle';
    setTimeout(() => {
      setLastRoll(scout);
      engine.set('d20', scout, 'scout');
      engine.set('char-maple', charge['maple'], 'scouting');
      pushLog(`MAPLE scouts "${room.name}" — d20 → ${scout}. ${scoutKnows ? 'The air says: this room rewards what you remember.' : 'No ambush scent. Straight strength will do.'}`, 'text-emerald-300');
    }, 500);

    // beat 2 — the acting cell faces the room
    setTimeout(() => {
      const actor = room.kind === 'trap' ? 'wren' : room.kind === 'riddle' ? 'sol' : 'borin';
      const roll = d20(rng);
      const bonus = 2 * bondsOf(actor) + (actor === 'wren' && scoutKnows ? 3 : 0) + (scout >= 15 ? 1 : 0);
      const total = roll + bonus;
      setLastRoll(roll);
      engine.set('d20', roll, 'action');
      engine.set('char-' + actor, charge[actor], 'acting');
      engine.set('room-idx', roomIdx);
      engine.set('bond-n', bonds.length);
      const success = total >= room.difficulty;
      pushLog(`${actor.toUpperCase()} faces the room — d20 → ${roll} ${bonus ? `+${bonus} from bonds${scout >= 15 ? ' +1 from the scout' : ''}` : ''} = ${total} vs ${room.difficulty}.`, 'text-cyan-300');
      if (success) {
        const spent = 8 + Math.floor(rng() * 10);
        setCharge((c) => ({ ...c, [actor]: Math.max(20, c[actor] - spent) }));
        pushLog(`SUCCESS — the room yields. ${room.kind === 'treasure' ? 'They carry what it held.' : 'The way opens.'}`, 'text-emerald-300 font-bold');
        const next = roomIdx + 1;
        if (room.camp) setCamps((cs) => [...cs, { roomIdx, charge: { ...charge }, turn: t }]);
        if (next >= ROOM_NAMES.length) {
          setWon(true);
          engine.emit({ type: 'milestone', detail: 'THE DUNGEON HEART falls — the party-quilt held' });
          pushLog('the dungeon is decomposed for good — run complete.', 'text-white font-bold');
        } else {
          setRoomIdx(next);
          pushLog(`the party descends to "${ROOM_NAMES[next].name}".`, 'text-zinc-300');
        }
        setFails(0);
      } else {
        const nf = fails + 1;
        setFails(nf);
        pushLog(`FAILED — ${nf === 1 ? 'the room holds. The party regroups.' : 'it holds AGAIN.'}`, 'text-rose-400 font-bold');
        if (nf >= 2 && !gm.awake) {
          // the GM — the decomposer — wakes
          const suggestion = SUGGESTIONS[gm.wakes % SUGGESTIONS.length];
          setGm((s) => ({ ...s, awake: true, suggestion, live: false }));
          engine.wakeDecomposer(`two failures in "${room.name}"`, [
            'decomposed the room into what each cell knew when it failed',
            `found the missing hook: ${suggestion.bond[0].toUpperCase()} ⇄ ${suggestion.bond[1].toUpperCase()}`,
            'wrote the suggestion into the scene log — the party may apply it',
          ]);
          engine.set('gm', engine.decomposer.wakeCount, 'awake');
          if (liveGm) {
            // demo-mode: ONE real call, server-side keyed, receipted in the log
            fetch('/api/dungeon-gm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room: room.name, difficulty: room.difficulty, bonds, fails: nf }),
            })
              .then((r) => r.json())
              .then((d: { ok: boolean; bond?: string[]; line?: string; source?: string; error?: string }) => {
                if (d.ok && d.bond && d.line) {
                  setGm((s) => ({ ...s, suggestion: { bond: d.bond as [string, string], text: d.line ?? '' }, live: true }));
                  pushLog(`LIVE GM — ${d.source}`, 'text-fuchsia-300 font-bold');
                  pushLog(`LIVE GM says: ${d.line} (bond: ${d.bond?.join(' ⇄ ')})`, 'text-fuchsia-200');
                } else {
                  pushLog(`live GM unavailable (${d.error ?? 'unknown'}) — local decomposer stays on duty`, 'text-zinc-500');
                }
              })
              .catch(() => pushLog('live GM unreachable — local decomposer stays on duty', 'text-zinc-500'));
          }
        }
      }
      setBusy(false);
    }, 1400);
  }, [busy, turn, roomIdx, charge, bonds, fails, gm, liveGm, won, engine, seed, pushLog, rngFor]);

  const applySuggestion = () => {
    if (!gm.suggestion) return;
    const [a, b] = gm.suggestion.bond;
    setBonds((bs) => (bs.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)) ? bs : [...bs, { a, b }]));
    setGm((s) => ({ awake: false, suggestion: null, wakes: s.wakes + 1, live: s.live }));
    setFails(0);
    pushLog(`wiring applied — ${gm.suggestion.text}`, 'text-amber-300 font-bold');
    pushLog('the GM sleeps. rewind to camp and replay the room, re-wired.', 'text-zinc-400');
  };

  const rewindToCamp = () => {
    const camp = camps[camps.length - 1];
    if (!camp) { pushLog('no camp reached yet — the first stable point is the Quiet Camp.', 'text-zinc-500'); return; }
    setRoomIdx(camp.roomIdx);
    setCharge({ ...camp.charge });
    setTurn(camp.turn);
    setFails(0);
    setWon(false);
    setGm((s) => ({ ...s, awake: false, suggestion: null }));
    pushLog(`rewound to "${ROOM_NAMES[camp.roomIdx].name}" (stable point) — same seed ${seed}, re-wired party. Replay.`, 'text-amber-300 font-bold');
  };

  const room = ROOM_NAMES[roomIdx];
  const bondLabel = useMemo(() => bonds.map((b) => `${b.a[0].toUpperCase()}⇄${b.b[0].toUpperCase()}`).join('  '), [bonds]);

  return (
    <div className="space-y-4">
      {/* scene header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-xs text-zinc-400">
          <span className="mr-3 rounded border border-fuchsia-800 bg-fuchsia-950/40 px-2 py-1 text-fuchsia-300">seed {seed} — citable, deterministic</span>
          <span className="mr-3">bonds: <span className="text-cyan-300">{bondLabel || 'none'}</span></span>
          <span>camps: <span className="text-amber-300">{camps.length}</span></span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setLiveGm((v) => !v)}
            title="when stuck, the GM takes ONE real server-side model call (groq/gpt-oss-20b) and the receipt lands in the scene log"
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              liveGm ? 'border border-fuchsia-500 bg-fuchsia-950/60 text-fuchsia-200' : 'border border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            {liveGm ? '● live GM: on' : '○ live GM: off'}
          </button>
          <button onClick={rewindToCamp} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500">↺ rewind to camp</button>
          <button
            onClick={rollScene}
            disabled={busy || won}
            className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:opacity-40"
          >
            🎲 roll the scene
          </button>
        </div>
      </div>

      {/* the corridor of rooms */}
      <div className="rounded-2xl border border-zinc-800 bg-[radial-gradient(ellipse_at_top,#120b1e,#07090b)] p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
          {ROOM_NAMES.map((r, i) => (
            <div key={r.name} className="flex shrink-0 items-center gap-1.5">
              <div className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                i === roomIdx ? 'border-white bg-zinc-800 text-white shadow-[0_0_18px_-4px_rgba(255,255,255,0.5)]'
                : i < roomIdx ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400'
                : 'border-zinc-800 text-zinc-600'
              } ${r.camp ? 'outline outline-amber-600/40' : ''}`}>
                {r.camp && '⛺ '}{i < roomIdx ? '✓ ' : ''}{r.name}
              </div>
              {i < ROOM_NAMES.length - 1 && <span className="text-zinc-700">→</span>}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          {/* the room + the party */}
          <div>
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">{room.kind} · difficulty {room.difficulty}</p>
              <h3 className="mt-1 text-xl font-black text-white">{room.name}</h3>
              <p className="mt-1 text-sm text-zinc-400">{room.blurb}</p>
              {lastRoll !== null && (
                <p className="mt-2 font-mono text-sm text-fuchsia-300">last d20: <span className="text-2xl font-black">{lastRoll}</span></p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PARTY.map((c) => (
                <div key={c.id} className={`rounded-xl border bg-zinc-950 p-2.5 ${KIND_COLOR[c.kind]}`}>
                  <p className="font-mono text-xs font-black tracking-wider">{c.name}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">{c.role}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-current transition-all duration-500" style={{ width: `${charge[c.id]}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">charge {charge[c.id]}</p>
                </div>
              ))}
            </div>
          </div>

          {/* scene log — the rewindable greater scene */}
          <div className="rounded-xl border border-zinc-800 bg-black/50 p-3">
            <p className="mb-2 font-mono text-[10px] tracking-widest text-zinc-500 uppercase">scene log — rewindable greater scene</p>
            <div className="max-h-64 space-y-1.5 overflow-y-auto font-mono text-xs">
              {log.map((l, i) => (
                <p key={i} className={l.cls}>{l.text}</p>
              ))}
            </div>
          </div>
        </div>

        {/* GM banner — the decomposer of stories */}
        {gm.awake && gm.suggestion && (
          <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
            <p className="font-mono text-sm font-bold tracking-widest text-amber-300 uppercase">◈ the GM wakes — wake #{gm.wakes + 1} {gm.live && '· live run'}</p>
            <p className="mt-1.5 text-sm text-amber-100">{gm.suggestion.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={applySuggestion} className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black hover:bg-amber-300">apply the re-wiring</button>
              <span className="self-center text-xs text-amber-200/70">then rewind to camp — the same seed replays honestly, the new bond changes the math</span>
            </div>
          </div>
        )}
        {won && (
          <div className="mt-4 rounded-xl border border-emerald-500/60 bg-emerald-500/10 p-4 text-center">
            <p className="text-lg font-black text-emerald-300">the dungeon is decomposed — every room a cell, every bond a hook, the party a quilt.</p>
            <p className="mt-1 text-sm text-emerald-200/80">seed {seed} · {camps.length} camps · rewinds honored</p>
          </div>
        )}
      </div>

      <QuiltXRay
        engine={engine}
        layers={LAYERS}
        simTitle="The scene, and the cells underneath it"
        simBlurb="a story on top — the same run as live quilt cells below, dice included"
      >
        <p className="rounded-xl border border-zinc-800 bg-black/40 p-4 text-sm leading-relaxed text-zinc-300">
          Roll the scene above. Every beat lands down here: the scout&apos;s d20, the actor&apos;s charge,
          the bond count, the GM&apos;s wakes. Two failures wake the GM — the decomposer of stories —
          and its suggestion is a <span className="text-cyan-300">hook</span> you can add to the party
          wiring. Rewind to a camp and the same seed replays honestly; the new bond changes the math.
          That loop — stuck → decompose → re-wire → rewind → replay — is the whole method, dressed as a story.
        </p>
      </QuiltXRay>
    </div>
  );
}
