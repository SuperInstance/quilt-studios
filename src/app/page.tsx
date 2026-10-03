'use client';

import { useState } from 'react';
import SeedGarden from '@/components/studios/SeedGarden';
import MelonSandbox from '@/components/studios/MelonSandbox';
import QuiltComposer from '@/components/studios/QuiltComposer';
import PongXRay from '@/components/studios/PongXRay';
import DesignNotes from '@/components/studios/DesignNotes';

type RungId = 'pong' | 'garden' | 'melon' | 'composer';

const RUNGS: { id: RungId; n: string; name: string; who: string; blurb: string }[] = [
  {
    id: 'pong', n: 'IV', name: 'Pong X-Ray', who: 'pro simulation',
    blurb: 'A real game above; the functional quilt below — ball cells streaming, input cells lighting on your keypresses, the call counter falling as the quilt learns, the decomposer waking when it gets stuck.',
  },
  {
    id: 'garden', n: 'I', name: 'Seed Garden', who: 'sandbox · littlest hands',
    blurb: 'Cells, hooks, hops and drops as living things you plant and poke. Nothing can fail. The journal fills itself as concepts are met.',
  },
  {
    id: 'melon', n: 'II', name: 'Melon-Sandbox', who: 'puzzles · curious kids',
    blurb: 'A random world, a random three-hop brain, a melon. Rewire, rewind, replay — and break it on purpose.',
  },
  {
    id: 'composer', n: 'III', name: 'Quilt Composer', who: 'student studio',
    blurb: 'Track lanes are cells, the patch bay wires hops, patterns save as drops. A composition is a computation you can hear.',
  },
];

export default function Page() {
  const [rung, setRung] = useState<RungId>('pong');
  const active = RUNGS.find((r) => r.id === rung)!;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* nav */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <span className="font-mono text-sm font-black tracking-[0.25em] text-white">QUILT·STUDIOS</span>
          <nav className="flex flex-wrap gap-1.5" aria-label="studios">
            {RUNGS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRung(r.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  rung === r.id ? 'bg-white text-black' : 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <span className="mr-1.5 font-mono text-[10px] opacity-60">{r.n}</span>
                {r.name}
              </button>
            ))}
            <a
              href="#notes"
              className="rounded-full border border-fuchsia-800 px-3 py-1.5 text-xs font-semibold text-fuchsia-300 transition hover:bg-fuchsia-950/60"
            >
              design notes
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
        {/* hero */}
        <section className="py-10 text-center sm:py-14">
          <p className="mb-3 font-mono text-[11px] tracking-[0.35em] text-fuchsia-400 uppercase">one engine · four rungs · scroll for truth</p>
          <h1 className="mx-auto max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl">
            Play the game.
            <br />
            Then scroll down and{' '}
            <span className="bg-gradient-to-r from-emerald-300 via-amber-200 to-fuchsia-400 bg-clip-text text-transparent">
              watch the quilt think.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Every studio here is a demonstration of the same idea: simulations on top, functional quilt
            layers underneath — real values, real cells lighting up in real time. From a garden where
            four-year-olds befriend numbers to a pong run whose call counter falls as it learns.
          </p>
        </section>

        {/* the ladder */}
        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="the ladder of studios">
          {RUNGS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRung(r.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                rung === r.id
                  ? 'border-white bg-zinc-900 shadow-[0_0_30px_-10px_rgba(255,255,255,0.3)]'
                  : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'
              }`}
            >
              <span className="font-mono text-[10px] tracking-widest text-zinc-500">{r.n} · {r.who}</span>
              <p className="mt-1 font-bold text-white">{r.name}</p>
            </button>
          ))}
        </section>

        {/* active studio */}
        <section className="mb-16" aria-label={`${active.name} studio`}>
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white sm:text-3xl">{active.name}</h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-400">{active.blurb}</p>
          </div>
          {rung === 'pong' && <PongXRay key="pong" />}
          {rung === 'garden' && <SeedGarden key="garden" />}
          {rung === 'melon' && <MelonSandbox key="melon" />}
          {rung === 'composer' && <QuiltComposer key="composer" />}
        </section>

        {/* design notes — the brainstorm */}
        <section id="notes" className="scroll-mt-20 border-t border-zinc-800 pt-10">
          <h2 className="mb-2 text-2xl font-black text-white sm:text-3xl">Design notes — the brainstorm</h2>
          <p className="mb-6 max-w-3xl text-sm leading-relaxed text-zinc-400">
            Which concepts fit which rungs, and where the ah-ha moments live. Seeds, not specs — every
            entry is an invitation to argue with, iterate on, and grow into something better.
          </p>
          <DesignNotes />
        </section>
      </main>

      {/* sticky footer */}
      <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 font-mono text-[11px] text-zinc-500">
          <span>quilt-studios · seeds, not specs · SuperInstance</span>
          <span>cells hold · hooks link · hops transform · the orchestrator asks · the decomposer untangles</span>
        </div>
      </footer>
    </div>
  );
}
