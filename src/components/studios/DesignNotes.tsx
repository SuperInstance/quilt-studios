'use client';

/*
 * DESIGN NOTES — the brainstorm, kept public on purpose.
 * Which concepts fit which rungs, and where the ah-ha moments live.
 * Seeds, not specs: every entry here is an invitation to argue with.
 */

const RUNGS = [
  {
    rung: 'Rung 1 — Seed Garden',
    who: 'littlest hands (~4–8) · sandbox',
    fit: 'The four atoms — cell, hook, hop, drop — become living things you plant, poke and befriend. Nothing can fail. Poking is the whole curriculum.',
    aha: '"Numbers LIVE in things, and friendships make numbers move." A four-year-old who has wiggled a hooked pod has already understood reactive state.',
    next: 'A melody garden where hooks hum; a night mode where cells glow like fireflies; drops as seed packets to swap with a friend across the table.',
  },
  {
    rung: 'Rung 2 — Melon-Sandbox',
    who: 'curious kids (~8–12) · puzzles on top of sandbox tools',
    fit: 'Random worlds + random brains (three visible op slots between sense and act). The agent fails hilariously; the player rewires, rewinds, replays. Break-on-purpose challenge cards teach by inversion.',
    aha: '"The creature isn\'t dumb — its WIRING is." Debugging reframed as the game itself, and the sense→hop→act strip lights up every beat so the behavior is never magic.',
    next: 'Two agents sharing one melon; brains that drift (a hop that mutates each run); replay-the-best-run as a "greatest scene" you can rewind granularly.',
  },
  {
    rung: 'Rung 3 — Quilt Composer',
    who: 'students (~12+) · GarageBand / FruityLoops tier',
    fit: 'Track lanes are cells; the patch bay wires hops (echo / double / invert) between them; patterns save as drops — nested, bootable units. WebAudio transport makes the values audible.',
    aha: '"A composition is a computation." Dashed cells show values arriving through a hop instead of living in the lane — dataflow stops being a diagram and becomes a groove.',
    next: 'Record-and-overdub; per-step JEV-style consults ("the composer asks the orchestrator for a fill"); export drops that other students\' sessions can boot.',
  },
  {
    rung: 'Rung 4 — Pong X-Ray',
    who: 'professionals & pros-at-heart · simulation',
    fit: 'A real game at 60fps; below the fold the same run as live cells — BALL·X, BALL·Y, HUMAN·IN lighting on keypress, PLAN·AI deciding. The call economy is the lesson: consults cost, every consult teaches the table, calls decelerate as confidence climbs. Repeated misses wake THE DECOMPOSER — the slow big agent — which adjusts the wiring and sleeps.',
    aha: '"Watch the calls fall." The moment a professional sees the quilt need less and less from outside — internalization as a visible curve — the whole architecture pitch collapses into one screen.',
    next: 'Demo-mode streaming from real runs (JEV via server routes, Cloudflare tiny agents as the fast layer, Moth pulses for placement, the decomposer on a real slower model); replay-to-stable-point scrubbing over the run log.',
  },
];

const SHARED = [
  {
    title: 'The dungeon',
    body: 'A ttrpg-shaped run where the party IS a quilt: each character a cell, each bond a hook, the GM a decomposer who only speaks when the party is stuck. Younger players feel a story; professionals recognize orchestrated agents with receipts. One skin, two audiences, exactly as erised intends.',
  },
  {
    title: 'Platonic randomness as the dice',
    body: 'Every "generate me something cool" in every rung rolls the same honest dice — pure geometric randomness — so kids trust the generator and pros can cite the seed. Randomness is the shared mortar between all four rungs.',
  },
  {
    title: 'The scroll is the syllabus',
    body: 'Every studio is simulation-first at the top and functional quilt layers below the fold. Play first, then scroll into truth. The format itself teaches: nothing here is a mockup — every glowing cell is the real value of the thing you were just playing with.',
  },
  {
    title: 'Play-tests → play-throughs → demo-mode',
    body: 'The ladder doubles as our own pipeline: we play-test cells in the garden, play through wirings in the sandbox, compose in the studio, and the pro rung streams real runs. The demo site is not ABOUT the pipeline — it IS the pipeline, gamified, with real conceptual work-product leaving every session.',
  },
];

export default function DesignNotes() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-2">
        {RUNGS.map((r) => (
          <div key={r.rung} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-bold text-white">{r.rung}</h3>
              <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">{r.who}</span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-300">{r.fit}</p>
            <p className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3 text-sm leading-relaxed text-emerald-200">
              <span className="font-bold">Ah-ha:</span> {r.aha}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              <span className="font-semibold text-zinc-400">Seeds ahead:</span> {r.next}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-3 font-mono text-xs font-bold tracking-widest text-zinc-400 uppercase">cross-rung ideas — where the rungs share one spine</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {SHARED.map((s) => (
            <div key={s.title} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
              <h4 className="mb-1.5 font-bold text-fuchsia-200">{s.title}</h4>
              <p className="text-sm leading-relaxed text-zinc-300">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
        <h3 className="mb-2 font-mono text-xs font-bold tracking-widest text-zinc-400 uppercase">the one-engine claim</h3>
        <p className="text-sm leading-relaxed text-zinc-300">
          All four rungs run the same <span className="font-mono text-fuchsia-300">QuiltEngine</span> — cells that hold,
          hooks that link, hops that transform, layers that sequence, an orchestrator that asks and a decomposer that
          untangles. Only the skin changes per age. That is the geometric-truth bet: the essence of the toolkit is
          independent of its use-case, the way DNA is a toolkit with variations. If a concept cannot be skinned down
          to a garden toy or up to a pro simulation, we do not yet understand it — and the ladder tells us which rung
          to rethink.
        </p>
      </div>
    </div>
  );
}
