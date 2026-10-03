# quilt-studios

**Play the game. Then scroll down and watch the quilt think.**

One engine, four rungs — a demonstration ladder where every studio is a simulation
on top and *functional quilt layers* underneath: real-time cell values, cells
lighting up when the world or the human moves, a run log you can read like a
receipt. Nothing on the page is a mockup — every glowing number is the live value
of the thing you were just playing with.

## The ladder

| Rung | Studio | Who | The ah-ha |
|------|--------|-----|-----------|
| I | **Seed Garden** | littlest hands (~4–8), sandbox | The four atoms — **cell, hook, hop, drop** — are living things you plant and poke. "Numbers LIVE in things, and friendships make numbers move." Nothing can fail. |
| II | **Melon-Sandbox** | curious kids (~8–12), puzzles | A random world, a random three-hop brain, a melon. "The creature isn't dumb — its *wiring* is." Rewire, rewind, replay; break it on purpose. |
| III | **Quilt Composer** | students (~12+), GarageBand tier | Track lanes are cells, the patch bay wires hops (echo / double / invert), patterns save as **drops**. "A composition is a computation you can hear." |
| IV | **Pong X-Ray** | professionals, simulation | A real game at 60fps; below the fold the same run as live cells. **The call economy**: consults cost, every consult teaches the table, calls decelerate as confidence climbs, and repeated misses wake **THE DECOMPOSER** — the slow big agent — which adjusts the wiring and sleeps. |

## The one-engine claim

All four rungs run the same `QuiltEngine` (`src/lib/quilt/engine.ts`):

- **CELLs hold** — a value, a kind (sensor / input / value / plan / memory / action), a glow that decays, a history sparkline.
- **HOOKs link** — change travels between friends.
- **HOPs transform** — values leave a cell and come back changed.
- **LAYERs sequence** — cells row into time.
- **The ORCHESTRATOR asks** — a consult economy with a lookup table: every consult both costs a call and teaches the table, so the quilt needs *less and less from outside* as its internal learning gets as good as it needs to be.
- **The DECOMPOSER untangles** — the slow big agent, woken by stuck-ness, adjusting wiring in visible beats, leaving the quilt more able.

Only the skin changes per age. That is the geometric-truth bet: the essence of the
toolkit is independent of its use-case, the way DNA is a toolkit with variations.
If a concept cannot be skinned down to a garden toy or up to a pro simulation, we
do not yet understand it — and the ladder tells us which rung to rethink.

## The scroll is the syllabus

Every studio is simulation-first at the top and functional quilt layers below the
fold. Play first, then scroll into truth. The format itself teaches: nothing here
is a mockup.

## The pipeline, gamified

The ladder doubles as our own pipeline: play-test cells in the garden, play
through wirings in the sandbox, compose in the studio, and the pro rung streams
real runs. The demo site is not ABOUT the pipeline — it IS the pipeline, with
real conceptual work-product leaving every session.

## Run it

```bash
bun install
bun run dev     # http://localhost:3000
bun run lint
```

No API keys needed — every rung runs fully client-side. The engine is
framework-agnostic TypeScript; lift `src/lib/quilt/engine.ts` into anything.

## Seeds, not specs

`docs/DESIGN-NOTES.md` is the brainstorm kept public on purpose: which concepts
fit which rungs, where the ah-ha moments live, and the cross-rung ideas (the
dungeon as a ttrpg-shaped quilt run, platonic randomness as the shared dice,
play-tests → play-throughs → demo-mode). Every entry is an invitation to argue
with.

---

quilt-studios · SuperInstance · cells hold · hooks link · hops transform · the
orchestrator asks · the decomposer untangles
