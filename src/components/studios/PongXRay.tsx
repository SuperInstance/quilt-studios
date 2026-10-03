'use client';

/*
 * Pong X-Ray — the flagship demonstration of the scroll-reveal pattern.
 *
 * Above the fold: a pong game anyone can play.
 * Below the fold: the functional quilt layers running the very same
 * game — BALL·X and BALL·Y cells streaming live, an input cell
 * lighting up on every arrow press, a plan cell deciding, a memory
 * cell counting the rally.
 *
 * The call economy: the AI paddle consults the orchestrator only when
 * a situation isn't internalized yet. Every consult teaches the table.
 * Watch "quilt calls" decelerate while "confidence" climbs — the quilt
 * needs less and less from outside. When it gets stuck (repeated
 * misses), THE DECOMPOSER — the slow big agent — wakes, decomposes,
 * adjusts the wiring, and sleeps, leaving the quilt more able.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { QuiltEngine } from '@/lib/quilt/engine';
import QuiltXRay, { type CellLayerDef } from './QuiltXRay';

const W = 640;
const H = 360;
const PADDLE_H = 64;
const PADDLE_W = 10;
const BALL_R = 6;
const AI_X = W - 28;
const Y_BUCKET = 30; // situation resolution: H/Y_BUCKET ≈ 12 buckets

interface Ball { x: number; y: number; vx: number; vy: number; speed: number }

const LAYERS: CellLayerDef[] = [
  {
    label: 'sensor layer — the world, streaming',
    blurb: 'the ball\'s position and velocity, exactly as the game sees it',
    cellIds: ['ball-x', 'ball-y', 'ball-vy'],
  },
  {
    label: 'input layer — the human',
    blurb: 'lights up the instant your arrow keys move the paddle',
    cellIds: ['human-in'],
  },
  {
    label: 'plan + memory layer — the deciding cells',
    blurb: 'the AI\'s chosen target, and the rally it is keeping in its head',
    cellIds: ['plan-ai', 'rally-n'],
  },
  {
    label: 'action layer — cells that touch the world',
    blurb: 'the two paddles as live values',
    cellIds: ['pdl-l', 'pdl-r'],
  },
];

export default function PongXRay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState({ you: 0, quilt: 0 });

  // lazy one-time engine construction — the sanctioned useState pattern
  const [engine] = useState<QuiltEngine>(() =>
    new QuiltEngine([
      { id: 'ball-x', label: 'BALL·X', kind: 'sensor' },
      { id: 'ball-y', label: 'BALL·Y', kind: 'sensor' },
      { id: 'ball-vy', label: 'BALL·VY', kind: 'sensor' },
      { id: 'human-in', label: 'HUMAN·IN', kind: 'input' },
      { id: 'plan-ai', label: 'PLAN·AI', kind: 'plan' },
      { id: 'rally-n', label: 'RALLY', kind: 'memory' },
      { id: 'pdl-l', label: 'PDL·LEFT', kind: 'action' },
      { id: 'pdl-r', label: 'PDL·RIGHT', kind: 'action' },
    ]),
  );

  // ---- mutable game state (outside React, 60fps) ----
  const g = useRef({
    you: H / 2, quilt: H / 2, youVy: 0,
    ball: { x: W / 2, y: H / 2, vx: 3.2, vy: 1.6, speed: 3.8 } as Ball,
    keys: { up: false, down: false },
    rally: 0, missStreak: 0, lastMissRally: -1,
    aiPlanTarget: H / 2, lastCallWasLive: false, liveGlow: 0,
    score: { you: 0, quilt: 0 }, started: false,
  });

  const serve = useCallback((towardAI: boolean) => {
    const b = g.current.ball;
    b.speed = 3.8;
    b.vx = towardAI ? b.speed : -b.speed;
    b.vy = (Math.random() * 2 - 1) * 2.2;
    b.x = W / 2; b.y = H / 2;
    g.current.rally = 0;
  }, []);

  const reset = useCallback(() => {
    g.current.you = H / 2; g.current.quilt = H / 2;
    g.current.score = { you: 0, quilt: 0 };
    setScore({ you: 0, quilt: 0 });
    engine.resetOrchestrator();
    serve(false);
  }, [engine, serve]);

  // ---- the orchestrator's "big slow" answer (the coach) ----
  const projectBallY = (b: Ball): number => {
    if (b.vx <= 0) return H / 2;
    const t = (AI_X - PADDLE_W - b.x) / b.vx;
    let y = b.y + b.vy * t;
    const span = H - 2 * BALL_R;
    y = ((y - BALL_R) % (2 * span) + 2 * span) % (2 * span);
    if (y > span) y = 2 * span - y;
    return y + BALL_R;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'w', 'W'].includes(e.key)) { g.current.keys.up = true; e.preventDefault(); }
      if (['ArrowDown', 's', 'S'].includes(e.key)) { g.current.keys.down = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowUp', 'w', 'W'].includes(e.key)) g.current.keys.up = false;
      if (['ArrowDown', 's', 'S'].includes(e.key)) g.current.keys.down = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1000 / 60;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      acc += now - last; last = now;
      if (acc > 200) acc = 200;
      while (acc >= STEP) { acc -= STEP; if (g.current.started) tick(); }
      draw();
    };

    const tick = () => {
      const s = g.current;
      const b = s.ball;
      engine.step();

      // ---- human input cell + paddle ----
      const inVal = (s.keys.up ? -1 : 0) + (s.keys.down ? 1 : 0);
      const inCell = engine.cells.get('human-in')!;
      if (inCell.value !== inVal) engine.set('human-in', inVal, inVal === 0 ? 'idle' : 'pressed');
      s.youVy = inVal * 5.2;
      s.you = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, s.you + s.youVy));
      engine.set('pdl-l', Math.round(s.you));

      // ---- sensors stream every tick ----
      engine.set('ball-x', Math.round(b.x));
      engine.set('ball-y', Math.round(b.y));
      engine.set('ball-vy', Math.round(b.vy * 10) / 10);

      // ---- the quilt decides (call economy lives here) ----
      const yBucket = Math.floor(b.y / Y_BUCKET);
      const vySign = b.vy >= 0 ? '+' : '-';
      const key = `y${yBucket}|vy${vySign}`;
      const { value: target, called } = engine.consult(
        key,
        () => projectBallY(b),          // the slow big coach answers
        (v) => v,                        // and teaches the table the same truth
      );
      s.lastCallWasLive = called;
      if (called) s.liveGlow = 1;
      s.aiPlanTarget = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, target));
      engine.set('plan-ai', Math.round(s.aiPlanTarget), called ? 'asked' : 'internal');

      // AI paddle chases its plan
      const diff = s.aiPlanTarget - s.quilt;
      s.quilt += Math.max(-4.6, Math.min(4.6, diff * 0.22));
      engine.set('pdl-r', Math.round(s.quilt));

      // ---- ball physics ----
      b.x += b.vx; b.y += b.vy;
      if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
      if (b.y > H - BALL_R) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy); }

      // left paddle collision
      if (b.vx < 0 && b.x - BALL_R <= 14 + PADDLE_W && b.x >= 14 &&
          Math.abs(b.y - s.you) <= PADDLE_H / 2 + BALL_R) {
        b.vx = Math.abs(b.vx) * 1.03;
        b.vy += (b.y - s.you) * 0.08 + s.youVy * 0.3;
        b.x = 14 + PADDLE_W + BALL_R;
        s.rally++;
        engine.set('rally-n', s.rally);
        engine.reinforce(key, target, 0.05);
      }
      // right (AI) paddle collision
      if (b.vx > 0 && b.x + BALL_R >= AI_X - PADDLE_W && b.x <= AI_X &&
          Math.abs(b.y - s.quilt) <= PADDLE_H / 2 + BALL_R) {
        b.vx = -Math.abs(b.vx) * 1.03;
        b.vy += (b.y - s.quilt) * 0.08;
        b.x = AI_X - PADDLE_W - BALL_R;
        s.rally++;
        engine.set('rally-n', s.rally);
        engine.reinforce(key, target, 0.08);
        if (s.rally > 0 && s.rally % 10 === 0) {
          engine.emit({ type: 'milestone', detail: `rally ${s.rally} — the quilt is holding its own` });
        }
      }

      // ---- scoring, stuck-ness, the decomposer ----
      if (b.x < -BALL_R * 4) { s.score.quilt++; setScore({ ...s.score }); s.missStreak = 0; serve(false); }
      if (b.x > W + BALL_R * 4) {
        s.score.you++; setScore({ ...s.score });
        s.missStreak++;
        s.lastMissRally = s.rally;
        if (s.missStreak >= 2 && !engine.decomposer.awake) {
          const learning = engine.tableSize();
          engine.wakeDecomposer('two misses in a row', [
            `re-examined ${learning} internalized situations against the miss angle`,
            'widened the plan cell\'s tolerance at the wall bounce cases',
            'reinforced the missed bucket three times so it can never be shy again',
          ]);
          s.missStreak = 0;
        }
        serve(true);
      }
      if (s.liveGlow > 0) s.liveGlow = Math.max(0, s.liveGlow - 0.05);
    };

    const draw = () => {
      const s = g.current;
      const b = s.ball;
      // court
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#27272a';
      ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.setLineDash([]);

      // call pulse — a halo when the orchestrator was consulted this beat
      if (s.liveGlow > 0) {
        ctx.fillStyle = `rgba(217, 70, 239, ${s.liveGlow * 0.08})`;
        ctx.fillRect(0, 0, W, H);
      }

      // paddles
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(14, s.you - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.fillStyle = s.liveGlow > 0.3 ? '#e879f9' : '#a1a1aa';
      ctx.fillRect(AI_X - PADDLE_W, s.quilt - PADDLE_H / 2, PADDLE_W, PADDLE_H);

      // ball + trail
      for (let i = 1; i <= 5; i++) {
        ctx.fillStyle = `rgba(250,250,250,${0.05 * (6 - i)})`;
        ctx.beginPath();
        ctx.arc(b.x - b.vx * i * 1.6, b.y - b.vy * i * 1.6, BALL_R - i * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fafafa';
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();

      // score
      ctx.font = '600 42px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.textAlign = 'center';
      ctx.fillText(String(s.score.you), W / 2 - 60, 54);
      ctx.fillText(String(s.score.quilt), W / 2 + 60, 54);

      if (!s.started) {
        ctx.font = '600 16px ui-sans-serif, system-ui';
        ctx.fillStyle = '#e4e4e7';
        ctx.fillText('press start — you are the left paddle', W / 2, H / 2 - 14);
        ctx.font = '400 12px ui-sans-serif, system-ui';
        ctx.fillStyle = '#71717a';
        ctx.fillText('W/S or ↑/↓ to move · then scroll down to see the quilt thinking', W / 2, H / 2 + 10);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, serve]);

  const start = () => {
    g.current.started = true;
    setStarted(true);
    engine.emit({ type: 'milestone', detail: 'run started — every sensor cell is now streaming live' });
  };

  const touchMove = (dir: -1 | 0 | 1) => () => {
    g.current.keys.up = dir === -1;
    g.current.keys.down = dir === 1;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 font-mono text-sm text-zinc-300">
          <span>YOU <span className="text-xl font-bold text-white">{score.you}</span></span>
          <span className="text-zinc-600">·</span>
          <span>QUILT <span className="text-xl font-bold text-fuchsia-300">{score.quilt}</span></span>
        </div>
        <div className="flex items-center gap-2">
          {!started ? (
            <button
              onClick={start}
              className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              ▶ start the run
            </button>
          ) : (
            <button
              onClick={reset}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              ↺ rewind to stable point
            </button>
          )}
        </div>
      </div>

      <QuiltXRay
        engine={engine}
        layers={LAYERS}
        simTitle="Pong, played by a human and a quilt"
        simBlurb="the classic game — but every frame of it is a live quilt run"
      >
        <div className="relative overflow-hidden rounded-xl border border-zinc-800">
          <canvas ref={canvasRef} width={W} height={H} className="block w-full" />
        </div>
        {/* touch controls */}
        <div className="mt-3 flex justify-center gap-3 sm:hidden">
          <button onTouchStart={touchMove(-1)} onTouchEnd={touchMove(0)}
            className="h-14 w-24 rounded-xl border border-zinc-700 bg-zinc-900 text-xl text-white">↑</button>
          <button onTouchStart={touchMove(1)} onTouchEnd={touchMove(0)}
            className="h-14 w-24 rounded-xl border border-zinc-700 bg-zinc-900 text-xl text-white">↓</button>
        </div>
        <p className="mt-3 hidden text-center text-xs text-zinc-500 sm:block">
          W/S or ↑/↓ — watch the HUMAN·IN cell light up below when you move
        </p>
      </QuiltXRay>
    </div>
  );
}
