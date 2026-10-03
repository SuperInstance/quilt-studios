import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { castById } from '@/lib/night/cast';

/*
 * /api/night-cast — the live cast seam for the Night Engine.
 *
 * Six canon characters, six skins, five real models across two providers.
 * The browser never sees a key: this route reads .env.keys server-side,
 * calls ONE model for ONE beat, and returns a strict JSON contract.
 *
 * Understudy rule: if the character's model is unreachable, deepseek-chat
 * steps in and the response says so (understudy: true). The receipt is
 * booked in the scene log either way — nothing is silently swapped.
 *
 * This is demo-mode for ai-writings: real runs stream real dialogue into
 * the presentation. The same sheets are used headless in
 * scripts/night-run.ts for the recorded nights.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

function envKey(name: string): string | null {
  if (process.env[name]) return process.env[name] as string;
  try {
    const txt = readFileSync('/home/z/my-project/.env.keys', 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith(name + '='));
    return line ? line.split('=').slice(1).join('=').trim() : null;
  } catch {
    return null;
  }
}

async function callModel(
  url: string, key: string, model: string, system: string, user: string, timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.9,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content as string) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface CastRequest {
  castId: string;
  scene: { title: string; situation: string; tension: string; secret: string };
  transcript: string[];       // recent beats, in order: "WESLEY says: ..." etc
  roll?: { who: string; sum: number; difficulty: number; failed: boolean; why: string };
  cue?: string;               // optional GM nudge ("the table looks at you")
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CastRequest | null;
  const member = body ? castById(body.castId) : undefined;
  if (!member || !body) {
    return NextResponse.json({ ok: false, error: 'need { castId, scene, transcript[] }' }, { status: 400 });
  }

  const deepKey = envKey('DEEPSEEK_API_KEY');
  const diKey = envKey('DEEPINFRA_API_KEY');
  if (!deepKey && !diKey) {
    return NextResponse.json({ ok: false, error: 'no model keys on server — the understudy is a local recording tonight' });
  }

  const rollNote = body.roll
    ? `\nDICE: ${body.roll.who} rolled ${body.roll.sum} vs ${body.roll.difficulty} for "${body.roll.why}" — ${body.roll.failed ? 'FAILED. House convention: failure is material, not punishment. Weave in one of — a Cost (something true gets logged that stings), an Obstacle (the situation worsens honestly), or a Reveal (an uncomfortable fact surfaces). Never negate your own competence; negate your circumstances.' : 'succeeded, barely or cleanly — say how it feels to be helped or left out by luck.'}\n`
    : '';

  const cueNote = body.cue ? `\nGM CUE: ${body.cue}\n` : '';

  const user = `THE SCENE — "${body.scene.title}"
Situation: ${body.scene.situation}
Tension on the table: ${body.scene.tension}

THE NIGHT SO FAR (in order):
${body.transcript.slice(-8).map((t) => '- ' + t).join('\n') || '(you are opening the night)'}${rollNote}${cueNote}
YOUR TURN. React as ${member.name} — to the newest beats especially. Speak in character, react to at least one specific thing another character said, and let your WANT tug at your line. Reply ONLY with JSON:
{"say":"<what you say aloud, max 55 words, in your voice>","act":"<what you do, max 25 words, present tense>","want":"<what you actually want right now, max 12 words>"}`;

  const attempts: { url: string; key: string; model: string }[] = [];
  if (member.provider === 'deepseek' && deepKey) {
    attempts.push({ url: 'https://api.deepseek.com/chat/completions', key: deepKey, model: member.model });
  } else if (member.provider === 'deepinfra' && diKey) {
    attempts.push({ url: 'https://api.deepinfra.com/v1/openai/chat/completions', key: diKey, model: member.model });
  }
  // understudy: deepseek-chat steps in if the skin's own model is unreachable
  if (deepKey && !attempts.some((a) => a.model === 'deepseek-chat')) {
    attempts.push({ url: 'https://api.deepseek.com/chat/completions', key: deepKey, model: 'deepseek-chat' });
  }

  for (const a of attempts) {
    const raw = await callModel(a.url, a.key, a.model, member.system, user, 45000);
    if (!raw) continue;
    const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    try {
      const parsed = JSON.parse(jsonText) as { say?: string; act?: string; want?: string };
      if (!parsed.say || typeof parsed.say !== 'string') continue;
      return NextResponse.json({
        ok: true,
        source: a.model,
        understudy: a.model !== member.model,
        say: parsed.say.slice(0, 700),
        act: (parsed.act ?? '').slice(0, 300),
        want: (parsed.want ?? '').slice(0, 200),
      });
    } catch {
      continue;
    }
  }
  return NextResponse.json({ ok: false, error: 'all live skins unreachable — the local recording plays the beat' });
}
