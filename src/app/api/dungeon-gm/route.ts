import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';

/*
 * /api/dungeon-gm — the demo-mode seam.
 *
 * "real-data streaming into the web presentation from real runs":
 * when the party is stuck, the client may ask the LIVE GM. This route
 * is the only place a key is ever read — server-side, never shipped to
 * the browser. One small call per wake, strict JSON contract, hard
 * timeout, graceful fallback (the client keeps its local decomposer).
 *
 * Fast layer: DeepSeek deepseek-chat (~1s, strict JSON, cache-friendly).
 * Secondary: Groq gpt-oss-20b. If both unavailable, ok:false is returned
 * and the local decomposer narrates.
 */

export const runtime = 'nodejs';

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

const VALID_IDS = ['maple', 'borin', 'wren', 'sol'];

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.room !== 'string') {
    return NextResponse.json({ ok: false, error: 'need { room, difficulty, bonds, fails }' }, { status: 400 });
  }

  const groqKey = envKey('GROQ_API_KEY');
  const deepKey = envKey('DEEPSEEK_API_KEY');
  if (!groqKey && !deepKey) {
    return NextResponse.json({ ok: false, error: 'no model keys on server — local decomposer stays on duty' });
  }

  const prompt = `You are the GM of a ttrpg where the adventuring party IS a quilt: each character is a cell (maple=scout/sensor, borin=fighter/action, wren=trickster/memory, sol=oracle/plan), each bond between two characters is a hook that lets change travel. The party failed this room twice: "${body.room}" (difficulty ${body.difficulty}). Existing bonds: ${JSON.stringify(body.bonds ?? [])}. Suggest ONE new bond that changes how the party is wired for this specific room, and one narrated GM line (max 28 words, no dice numbers). Reply ONLY with JSON: {"bond":["<id>","<id>"],"line":"<narration>"}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  // primary: deepseek (~1s); secondary: groq
  const attempts: { url: string; key: string; model: string }[] = [];
  if (deepKey) attempts.push({ url: 'https://api.deepseek.com/chat/completions', key: deepKey, model: 'deepseek-chat' });
  if (groqKey) attempts.push({ url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey, model: 'gpt-oss-20b' });
  try {
    for (const a of attempts) {
      try {
        const res = await fetch(a.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${a.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: a.model,
            messages: [
              { role: 'system', content: 'You reply with strict JSON only. No markdown, no code fences.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.8,
            max_tokens: 160,
          }),
          signal: controller.signal,
        });
        if (!res.ok) continue;
        const data = await res.json();
        const text: string = data?.choices?.[0]?.message?.content ?? '';
        const jsonText = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
        let parsed: { bond?: string[]; line?: string };
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          continue;
        }
        const bond = (parsed.bond ?? []).filter((id) => VALID_IDS.includes(id));
        if (bond.length !== 2 || bond[0] === bond[1]) continue;
        clearTimeout(timer);
        return NextResponse.json({
          ok: true,
          source: `${a.model} — live run, one call, receipted in the scene log`,
          bond,
          line: (parsed.line ?? 'The GM considers the wiring.').slice(0, 200),
        });
      } catch {
        continue;
      }
    }
    clearTimeout(timer);
    return NextResponse.json({ ok: false, error: 'all live layers unavailable — local decomposer stays on duty' });
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? (e.name === 'AbortError' ? 'timeout 9s' : 'fetch failed') : 'unknown';
    return NextResponse.json({ ok: false, error: msg });
  }
}
