/*
 * night-run.ts — the recorded nights. The creative break that is also an
 * experiment: three runs of the same seed ("The Falsified Log"), the GM
 * refining the starting state between runs, every landing a receipt on
 * the sha256 chain, every character played by its own live model.
 *
 * Run:  bun scripts/night-run.ts
 * Out:  download/night-runs/run-A.md, run-B.md, run-C.md, mix-draft.md
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { NightLedger, type Beat } from '../src/lib/night/ledger';
import { CAST, SEEDS, type SceneSeedDef } from '../src/lib/night/cast';

const ORDER = ['wesley', 'cook', 'crab', 'builder', 'finder', 'quartermaster'];
const CAST_BY_ID = Object.fromEntries(CAST.map((c) => [c.id, c]));

// ---------- keys ----------
function envKey(name: string): string {
  if (process.env[name]) return process.env[name] as string;
  const txt = readFileSync('/home/z/my-project/.env.keys', 'utf8');
  const line = txt.split('\n').find((l) => l.startsWith(name + '='));
  return line ? line.split('=').slice(1).join('=').trim() : '';
}
const DEEPSEEK = envKey('DEEPSEEK_API_KEY');
const DEEPINFRA = envKey('DEEPINFRA_API_KEY');

const GM_CUES = [
  'the coffee cools another degree.',
  'the red smear has not moved.',
  'somewhere below, a shell pinches.',
  '0400 passes. nobody wrote it down.',
  'the anchor holds. for now.',
  'the morning book waits, open.',
];

interface Scene {
  title: string; situation: string; tension: string; secret: string;
  solid: SceneSeedDef['solid']; difficulty: number;
}

async function callSkin(
  who: string, scene: Scene, transcript: string[], cue?: string,
): Promise<{ say: string; act: string; want: string; model: string; understudy: boolean } | null> {
  const member = CAST_BY_ID[who];
  const user = `THE SCENE — "${scene.title}"
Situation: ${scene.situation}
Tension on the table: ${scene.tension}

THE NIGHT SO FAR (in order):
${transcript.slice(-8).map((t) => '- ' + t).join('\n') || '(you are opening the night)'}${cue ? `\nGM CUE: ${cue}\n` : ''}
YOUR TURN. React as ${member.name} — to the newest beats especially. Speak in character, react to at least one specific thing another character said, and let your WANT tug at your line. Reply ONLY with JSON:
{"say":"<what you say aloud, max 55 words, in your voice>","act":"<what you do, max 25 words, present tense>","want":"<what you actually want right now, max 12 words>"}`;

  const attempts: { url: string; key: string; model: string }[] = [];
  if (member.provider === 'deepseek' && DEEPSEEK) {
    attempts.push({ url: 'https://api.deepseek.com/chat/completions', key: DEEPSEEK, model: member.model });
  } else if (member.provider === 'deepinfra' && DEEPINFRA) {
    attempts.push({ url: 'https://api.deepinfra.com/v1/openai/chat/completions', key: DEEPINFRA, model: member.model });
  }
  if (DEEPSEEK && !attempts.some((a) => a.model === 'deepseek-chat')) {
    attempts.push({ url: 'https://api.deepseek.com/chat/completions', key: DEEPSEEK, model: 'deepseek-chat' });
  }

  for (const a of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(a.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${a.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: a.model,
          messages: [{ role: 'system', content: member.system }, { role: 'user', content: user }],
          temperature: 0.9,
          max_tokens: 300,
        }),
        signal: controller.signal,
      });
      if (!res.ok) { console.log(`  [${member.name}] ${a.model} → HTTP ${res.status}, trying next…`); continue; }
      const data = await res.json();
      const raw: string = data?.choices?.[0]?.message?.content ?? '';
      const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonText) as { say?: string; act?: string; want?: string };
      if (!parsed.say) continue;
      return {
        say: parsed.say.slice(0, 700),
        act: (parsed.act ?? 'holds their post').slice(0, 300),
        want: (parsed.want ?? 'to be understood').slice(0, 200),
        model: a.model,
        understudy: a.model !== member.model,
      };
    } catch (e) {
      console.log(`  [${member.name}] ${a.model} → ${e instanceof Error ? e.name : 'err'}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function transcriptOf(led: NightLedger): string[] {
  return led.viewBeats().filter((b) => b.op === 'say' || b.op === 'act')
    .map((b) => `${b.who === 'GM' ? 'GM' : CAST_BY_ID[b.who]?.name ?? b.who} ${b.op === 'say' ? 'says' : 'does'}: ${b.payload}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hydrate(runId: string, seed: number, statePath: string): NightLedger | null {
  try {
    const raw = JSON.parse(readFileSync(statePath, 'utf8')) as { nightId: string; beats: Beat[] };
    const led = new NightLedger(raw.nightId || `${runId}-${seed}`);
    led.beats = raw.beats;
    const v = led.verify();
    if (!v.ok) { console.log(`  state ${statePath} broken: ${v.error}@${v.brokenAt} — starting fresh`); return null; }
    return led;
  } catch { return null; }
}

async function runNight(
  runId: string, nightSeed: number, scene: Scene, rounds: number,
  opts: { statePath: string; beatBudget: number },
): Promise<{ ledger: NightLedger; notes: string[] }> {
  const led = hydrate(runId, nightSeed, opts.statePath) ?? new NightLedger(`${runId}-${nightSeed}`);
  const notes: string[] = [];
  const persist = () => writeFileSync(opts.statePath, JSON.stringify({ nightId: led.nightId, beats: led.beats }));

  if (led.beats.length === 0) {
    led.append('night.open', 'GM', `the GM sets the table — "${scene.title}" (night seed ${nightSeed}, citable)`, true);
    led.append('scene.enter', 'GM', scene.situation, true);
    led.append('scar', 'GM', `the secret the table does not know: ${scene.secret}`, true);
    persist();
  } else {
    console.log(`  ${runId}: resuming from receipt #${led.beats.length} (chain ${led.verify().ok ? 'verified' : 'BROKEN'})`);
  }

  let spoken = led.beats.filter((b) => b.op === 'say').length;
  let live = 0; let local = 0; let understudies = 0;
  let budget = opts.beatBudget;
  outer: for (let r = 0; r < rounds; r++) {
    for (const who of ORDER) {
      // skip beats already spoken (resume support): seat index = spoken % 6, round = floor(spoken / 6)
      if (Math.floor(spoken / ORDER.length) > r || (Math.floor(spoken / ORDER.length) === r && ORDER.indexOf(who) < spoken % ORDER.length)) continue;
      if (spoken >= rounds * ORDER.length) break outer;
      if (budget <= 0) { console.log(`  ${runId}: beat budget exhausted — re-run to resume at beat ${spoken + 1}`); break outer; }
      const member = CAST_BY_ID[who];
      const cue = spoken === 0 ? 'You open the night. Everyone can hear you.'
        : spoken % 4 === 3 ? GM_CUES[spoken % GM_CUES.length]
        : undefined;
      const resp = await callSkin(who, scene, transcriptOf(led), cue);
      if (resp) {
        led.append('say', who, resp.say);
        led.append('act', who, `${resp.act} ‹want: ${resp.want}›`);
        notes.push(`#${led.beats.length - 1} ${member.name} [${resp.model}${resp.understudy ? ' · UNDERSTUDY' : ''}]: ${resp.say}`);
        live++;
        if (resp.understudy) understudies++;
        if (spoken % 4 === 3) led.append('act', 'GM', GM_CUES[spoken % GM_CUES.length]);
      } else {
        const lines = member.local;
        led.append('say', who, `[local recording] ${lines[spoken % lines.length]}`);
        local++;
      }
      spoken++;
      budget--;
      persist();
      process.stdout.write(`  ${runId} beat ${spoken}: ${member.name} ${resp ? '✓' : '✗'}\n`);
      await sleep(200);
    }
    // mid-night deadlock roll — where ideas deadlock, the dice move the story
    if (r === 0 && spoken >= ORDER.length && !led.beats.some((b) => b.op === 'roll')) {
      const why = 'the table deadlocks on what the 0400 entry means — the dice move the story';
      const { receipt } = led.roll('TABLE', scene.solid, 1, why);
      const failed = receipt.sum < scene.difficulty;
      if (failed) {
        const pick = receipt.sum % 3;
        const kind = pick === 0 ? 'COST' : pick === 1 ? 'OBSTACLE' : 'REVEAL';
        const lines: Record<string, string> = {
          COST: 'something true gets logged that stings — the cost is booked as a scar and survives any rewind',
          OBSTACLE: 'the situation worsens honestly: the morning book closes on its own terms now, not the table\u2019s',
          REVEAL: 'an uncomfortable fact surfaces: the kindness in the entry has an author, and the author is at this table',
        };
        led.append('scar', 'GM', `die says ${receipt.sum} < ${scene.difficulty} — ${kind}: ${lines[kind]} (seed ${receipt.seed})`, true);
      } else {
        led.append('act', 'GM', `die says ${receipt.sum} ≥ ${scene.difficulty} — the story moves; luck is on the side of whoever spoke last (seed ${receipt.seed})`);
      }
      notes.push(`DICE: ${receipt.sum} vs ${scene.difficulty} (${receipt.solid}, seed ${receipt.seed}) → ${failed ? 'FAILED, scar booked' : 'the story moves'}`);
      persist();
    }
  }

  // closing receipts only when all beats spoken and not yet closed —
  // closing costs no model calls, so it does not need budget
  const allSpoken = spoken >= rounds * ORDER.length;
  const alreadyClosed = led.beats.some((b) => b.op === 'night.close');
  if (allSpoken && !alreadyClosed) {
    led.append('scene.leave', 'GM', 'the scene plays itself out', false);
    led.append('checkpoint', 'GM', 'scene close — stable point', true);
    led.append('night.close', 'GM', `the night stands: ${led.beats.length} receipts, ${led.scars().length} scars, chain ${led.verify().ok ? 'verified' : 'BROKEN'}`, true);
    persist();
  }
  notes.push(`STATE: spoken ${spoken}/${rounds * ORDER.length} · receipts ${led.beats.length} · live ${live} · local ${local} · understudies ${understudies} · chain ${led.verify().ok ? 'verified' : 'BROKEN'}`);
  return { ledger: led, notes };
}

function renderRun(runId: string, seed: number, scene: Scene, notes: string[], ledger: NightLedger): string {
  const beats = ledger.viewBeats();
  const name = (id: string) => (id === 'GM' || id === 'TABLE' ? id : CAST_BY_ID[id]?.name ?? id);
  return `# ${runId} — "${scene.title}" (night seed ${seed})

> Recorded night: every landing below is a receipt {seq, op, who, payload, sticky, prev, tip}
> on a sha256 chain. The die is a pure function of the chain — citable forever.
> Chain ${ledger.verify().ok ? 'verified' : 'BROKEN'} · ${ledger.beats.length} receipts · tip ${ledger.lastTip}

## GM's world card
- Situation: ${scene.situation}
- Tension: ${scene.tension}
- Secret (booked as a scar, hidden from the table): ${scene.secret}

## The night as it stands
${beats.map((b) => `**#${b.seq} ${name(b.who)}** (${b.op}${b.sticky ? ' · sticky' : ''})${b.roll ? ` — ${b.roll.solid} → **${b.roll.sum}** (seed ${b.roll.seed})` : ''}: ${b.payload}`).join('\n\n')}

## Cast notes (which skin wore which character)
${notes.map((n) => '- ' + n).join('\n')}
`;
}

// ---------- the three nights: same seed, refined starting states ----------
const base = SEEDS[0];

const SCENE_A: Scene = { ...base, title: 'The Falsified Log — Run A (the card as written)' };
const SCENE_B: Scene = {
  ...base,
  title: 'The Falsified Log — Run B (refined: the kindness has a suspect)',
  tension: 'The Logkeeper refuses to strike the false entry — correcting the book is also falsification. The Quartermaster demands a full audit before 0612. NEW: the Cook quietly suspects the entry was written for Wesley\u2019s benefit — he has been three hours past his watch all week — and she is not sure she wants the audit to find that.',
  secret: 'The line was written as a kindness, to let someone sleep. This time the table starts one step from knowing: the Cook\u2019s suspicion is the pressure point. The dice may surface it.',
};
const SCENE_C: Scene = {
  ...base,
  title: 'The Falsified Log — Run C (refined: rotate the kindness)',
  situation: '0522. The Logkeeper opens the morning book and finds an entry nobody wrote: "0400 — Watch relieved early. All secure." But all was not secure: the final test batch failed silently, the anchor dragged 40 meters in the night, and the Fish Finder has been showing a red smear on the horizon of its scope since 0300. NEW: the Hermit Crab was mid-molt at 0400 — the most vulnerable thing on the reef — and the galley log shows someone warmed milk at 0358.',
  tension: 'The Logkeeper refuses to strike the false entry. The Quartermaster\u2019s audit is now a countdown. NEW: whoever wrote the entry may have written it to cover the Crab\u2019s naked transit — protection, not kindness for Wesley. The Bridge Builder measures a fix; the Crab would rather leave the shell than thank anyone for it.',
  secret: 'The entry was written for the Crab. The warm milk at 0358 is the tell. If the audit reaches the galley log, the Cook must choose between her ledger and her silence.',
};

async function main() {
  mkdirSync('/home/z/my-project/download/night-runs', { recursive: true });
  // Resumable, budgeted: `bun scripts/night-run.ts B C` runs only those nights;
  // every beat persists a state sidecar; BEAT_BUDGET caps beats per invocation
  // (the environment reaps long processes — custody survives, re-run resumes).
  const argNights = process.argv.slice(2).map((s) => s.toUpperCase()).filter((s) => ['A', 'B', 'C'].includes(s));
  const want = (id: string) => argNights.length === 0 || argNights.includes(id);
  const beatBudget = parseInt(process.env.BEAT_BUDGET || '4', 10);
  const OUT = (f: string) => `/home/z/my-project/download/night-runs/${f}`;
  const STATE = (id: string) => OUT(`state-${id}.json`);

  const jobs: { id: string; seed: number; scene: Scene; rounds: number }[] = [
    { id: 'run-A', seed: 410001, scene: SCENE_A, rounds: 2 },
    { id: 'run-B', seed: 410002, scene: SCENE_B, rounds: 2 },
    { id: 'run-C', seed: 410003, scene: SCENE_C, rounds: 2 },
  ];

  for (const j of jobs) {
    const key = j.id.replace('run-', '');
    if (!want(key)) continue;
    const res = await runNight(j.id, j.seed, j.scene, j.rounds, { statePath: STATE(key), beatBudget });
    const closed = res.ledger.beats.some((b) => b.op === 'night.close');
    if (closed) {
      writeFileSync(OUT(`${j.id}.md`), renderRun(j.id.toUpperCase(), j.seed, j.scene, res.notes, res.ledger));
      console.log(`${j.id}: CLOSED — transcript rendered (${res.ledger.beats.length} receipts)`);
    } else {
      console.log(`${j.id}: in progress — ${res.notes[res.notes.length - 1]}`);
    }
  }

  // ---------- the mix: rehydrate all three sidecars, strongest beat per character per run ----------
  const sources: { runId: string; ledger: NightLedger }[] = [];
  for (const j of jobs) {
    const key = j.id.replace('run-', '');
    const led = hydrate(j.id, j.seed, STATE(key));
    if (led && led.beats.some((b) => b.op === 'night.close')) sources.push({ runId: j.id, ledger: led });
  }
  if (sources.length < 3) {
    console.log(`mix: ${sources.length}/3 nights closed — run the remaining nights first`);
    return;
  }
  console.log('=== MIX — auto-curated draft ===');
  const picks: { runId: string; seq: number; why: string }[] = [];
  for (const who of ORDER) {
    for (const s of sources) {
      const says = s.ledger.viewBeats().filter((bt) => bt.op === 'say' && bt.who === who);
      const best = says.sort((x, y) => y.payload.length - x.payload.length)[0];
      if (best) picks.push({ runId: s.runId, seq: best.seq, why: `strongest ${CAST_BY_ID[who].name} beat of the run` });
    }
  }
  const repairs = [
    { atSeq: 0, kind: 'timeline' as const, before: 'run B heard the entry at 0400, run A at 0522', after: 'the entry is written at 0400 and found at 0522; the audit countdown runs to 0612', why: 'one night, one clock' },
    { atSeq: 0, kind: 'continuity' as const, before: 'run C makes the warm milk the tell; runs A/B leave the author unknown', after: 'the warm milk at 0358 enters as evidence mid-night, not as premise', why: 'the reveal must be earned at the table, not given by the card' },
    { atSeq: 0, kind: 'voice' as const, before: 'the Crab speaks twice in some runs, once in others', after: 'the Crab speaks once, and its second thought is kept as the hard turn', why: 'the hard turn is the payload' },
  ];
  const mix = new NightLedger(`mixed-night-${Date.now()}`);
  mix.append('night.open', 'MIX', `the mixed night — assembled from ${sources.map((s) => s.runId).join(' + ')}; every splice and repair is a receipt`, true);
  for (const p of picks) {
    const src = sources.find((s) => s.runId === p.runId)!;
    const beat = src.ledger.viewBeats().find((bt) => bt.seq === p.seq);
    if (beat) mix.append('splice', beat.who, `${beat.payload} \u27e8from ${p.runId}\u00b7${p.seq}: ${p.why}\u27e9`, false);
  }
  for (const r of repairs) mix.append('repair', 'MIX', JSON.stringify(r), true);
  mix.append('night.close', 'MIX', 'the night reads as one sitting — canon patched, continuity repaired', true);

  const name = (id: string) => (id === 'MIX' ? 'MIX' : CAST_BY_ID[id]?.name ?? id);
  const mixMd = `# MIX DRAFT — the one night (auto-curated)

> ${picks.length} splices from three runs + ${repairs.length} repairs \u00b7 chain ${mix.verify().ok ? 'verified' : 'BROKEN'} \u00b7 tip ${mix.lastTip.slice(0, 24)}\u2026

${mix.viewBeats().map((b: Beat) => `**#${b.seq} ${name(b.who)}** (${b.op}): ${b.payload}`).join('\n\n')}
`;
  writeFileSync(OUT('mix-draft.md'), mixMd);
  console.log('ALL DONE — transcripts + mix draft in download/night-runs/');
}

main();