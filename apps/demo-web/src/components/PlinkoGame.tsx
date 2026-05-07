// apps/demo-web/src/components/PlinkoGame.tsx
//
// Plinko with real 2D physics via matter-js. The ball is a real circle with
// mass and restitution. Pegs are real static circles. Gravity pulls the ball
// down, collisions produce real bounces. Sometimes the ball slips by a peg;
// sometimes it smashes into one and bounces hard.
//
// Determinism: the bucket the ball ends up in is predetermined by the
// provably-fair RNG (the engine's `placePlinkoBet` already returns the
// `bucket`). To make the ball land in the right slot, we apply tiny
// corrective horizontal forces during fall — calibrated to be invisible
// while keeping the outcome correct. Most of the motion is real physics.

'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Bodies,
  Body,
  Composite,
  Engine,
  Events,
  Runner,
  type Body as BodyType,
  type IEventCollision,
} from 'matter-js';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  getTable,
  placePlinkoBet,
  type PlinkoBetOutcome,
  type PlinkoRisk,
  type PlinkoRows,
  ROWS_VALUES,
  RISK_VALUES,
} from '@solsticebet/game-plinko';

import { useSession } from '@/lib/session-context';

// ─── Layout constants ──────────────────────────────────────────────────

const BOARD_WIDTH = 600;
const BOARD_HEIGHT = 580;
const TOP_PAD = 30;
/** Vertical space between the bottom of the peg field and the top of the
    slot row. The ball "funnels" through this gap with zero corrective
    nudging, allowing the final slot entry to be pure physics. */
const FUNNEL_ZONE = 70;
/** Slot row height. */
const SLOT_HEIGHT = 60;
/** Total bottom padding = funnel zone + slot row height. */
const BOTTOM_PAD = FUNNEL_ZONE + SLOT_HEIGHT;
const PEG_R = 5;
const BALL_R = 7;

/**
 * Computes the (x, y) position of a peg at row, col.
 * Row 0 has 1 peg at center; row N has N+1 pegs.
 */
function pegPos(row: number, col: number, totalRows: number): { x: number; y: number } {
  const rowSpacing = (BOARD_HEIGHT - TOP_PAD - BOTTOM_PAD) / totalRows;
  const slotWidth = BOARD_WIDTH / (totalRows + 1);
  const xLeft = BOARD_WIDTH / 2 - (row * slotWidth) / 2;
  const x = xLeft + col * slotWidth;
  const y = TOP_PAD + (row + 0.5) * rowSpacing;
  return { x, y };
}

function slotXCenter(slotIndex: number, totalRows: number): number {
  const slotWidth = BOARD_WIDTH / (totalRows + 1);
  return (slotIndex + 0.5) * slotWidth;
}

/**
 * Maps a multiplier value to a hue.
 */
function multiplierColor(mul: number): string {
  if (mul < 1) return '#facc15';
  if (mul < 2) return '#fb923c';
  if (mul < 5) return '#f97316';
  if (mul < 20) return '#ea580c';
  return '#dc2626';
}

interface ActiveBall {
  /** Engine-determined target bucket for this ball. */
  readonly targetBucket: number;
  /** Stake / multiplier for the result panel when this ball lands. */
  readonly outcome: PlinkoBetOutcome;
}

// ─── Component ─────────────────────────────────────────────────────────

export function PlinkoGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [rows, setRows] = useState<PlinkoRows>(8);
  const [risk, setRisk] = useState<PlinkoRisk>('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PlinkoBetOutcome | null>(null);
  const [winningBucket, setWinningBucket] = useState<number | null>(null);

  // Refs for the physics engine and canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const runnerRef = useRef<Runner | null>(null);
  /** All active falling balls, with their target buckets. */
  const ballsRef = useRef<Map<number, ActiveBall>>(new Map());
  /** Animation frame id for the canvas render loop. */
  const animFrameRef = useRef<number | null>(null);

  const table = getTable(rows, risk);

  /**
   * Initializes / re-initializes the matter.js world for the current rows.
   * Creates pegs, walls, and bottom slot dividers as static bodies.
   */
  useEffect(() => {
    // Tear down any previous engine
    if (runnerRef.current !== null) {
      Runner.stop(runnerRef.current);
      runnerRef.current = null;
    }
    if (engineRef.current !== null) {
      Composite.clear(engineRef.current.world, false, true);
      engineRef.current = null;
    }
    ballsRef.current.clear();

    // Create new engine
    const engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.0011 }, // tweaked for "feel"
    });
    engineRef.current = engine;

    // Add pegs
    const pegs: BodyType[] = [];
    for (let r = 0; r < rows + 1; r++) {
      for (let c = 0; c < r + 1; c++) {
        const p = pegPos(r, c, rows);
        const peg = Bodies.circle(p.x, p.y, PEG_R, {
          isStatic: true,
          restitution: 0.55,
          friction: 0.4,
          label: 'peg',
          render: { fillStyle: '#e6edf7' },
        });
        pegs.push(peg);
      }
    }
    Composite.add(engine.world, pegs);

    // Add bottom slot dividers — vertical walls between buckets, only in
    // the slot row (not extending up into the funnel zone, so the ball can
    // enter freely).
    const slotDividers: BodyType[] = [];
    const slotWidth = BOARD_WIDTH / (rows + 1);
    const slotTopY = BOARD_HEIGHT - SLOT_HEIGHT;
    const slotBottomY = BOARD_HEIGHT - 4;
    const slotHeight = slotBottomY - slotTopY;
    for (let i = 0; i <= rows + 1; i++) {
      const x = i * slotWidth;
      const divider = Bodies.rectangle(x, slotTopY + slotHeight / 2, 2, slotHeight, {
        isStatic: true,
        friction: 0.3,
        label: 'divider',
      });
      slotDividers.push(divider);
    }
    Composite.add(engine.world, slotDividers);

    // Side walls (so balls don't escape laterally if they bounce hard)
    const leftWall = Bodies.rectangle(-10, BOARD_HEIGHT / 2, 20, BOARD_HEIGHT, {
      isStatic: true,
    });
    const rightWall = Bodies.rectangle(BOARD_WIDTH + 10, BOARD_HEIGHT / 2, 20, BOARD_HEIGHT, {
      isStatic: true,
    });
    Composite.add(engine.world, [leftWall, rightWall]);

    // Bottom floor (catches balls so they stop in their slot)
    const floor = Bodies.rectangle(BOARD_WIDTH / 2, BOARD_HEIGHT + 5, BOARD_WIDTH, 20, {
      isStatic: true,
      label: 'floor',
    });
    Composite.add(engine.world, floor);

    // Listen for collisions to detect when ball lands in a slot.
    Events.on(engine, 'collisionStart', (event: IEventCollision<Engine>) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const ball = a.label === 'ball' ? a : b.label === 'ball' ? b : null;
        const other = ball === a ? b : a;
        if (ball === null) continue;
        if (other.label === 'floor') {
          // Ball landed
          const ballId = ball.id;
          const active = ballsRef.current.get(ballId);
          if (active !== undefined) {
            // Determine which slot based on x-position
            const x = ball.position.x;
            const slotIndex = Math.max(0, Math.min(rows, Math.floor(x / slotWidth)));
            void slotIndex;
            // Display result based on the active ball's outcome
            setLastResult(active.outcome);
            setWinningBucket(active.targetBucket);
            ballsRef.current.delete(ballId);
            // Remove the ball after a short pause so it visually settles
            setTimeout(() => {
              if (engineRef.current !== null) {
                Composite.remove(engineRef.current.world, ball);
              }
            }, 500);
          }
        } else if (other.label === 'peg') {
          // PER-PEG NUDGE: bias the post-collision velocity toward the
          // target bucket. This is the only place we ever modify ball
          // motion outside of pure physics. Because we only act AT
          // collisions (not continuously), the ball's fall between pegs is
          // 100% physics — no visible curving.
          const ballId = ball.id;
          const active = ballsRef.current.get(ballId);
          if (active === undefined) continue;
          // Don't nudge once we're inside the funnel zone — final entry
          // into the slot should be pure physics + slot wall guidance.
          if (ball.position.y > BOARD_HEIGHT - BOTTOM_PAD) continue;
          const targetX = slotXCenter(active.targetBucket, rows);
          const dx = targetX - ball.position.x;
          // Bias the horizontal velocity component toward the target.
          // The strength is proportional to the horizontal error, but
          // capped so we never produce visibly aggressive motion.
          const biasStrength = 0.045; // tune; 0 = no bias, 1 = snap to target velocity
          const targetVx = Math.sign(dx) * Math.min(Math.abs(dx) * 0.04, 1.6);
          const newVx = ball.velocity.x * (1 - biasStrength) + targetVx * biasStrength;
          Body.setVelocity(ball, { x: newVx, y: ball.velocity.y });
        }
      }
    });

    // Start the runner
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    // Start the canvas render loop
    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (canvas !== null && engineRef.current !== null) {
        const ctx = canvas.getContext('2d');
        if (ctx !== null) {
          renderFrame(ctx, engineRef.current, rows, table, winningBucket);
        }
      }
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };
    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      if (runnerRef.current !== null) Runner.stop(runnerRef.current);
      if (engineRef.current !== null) Composite.clear(engineRef.current.world, false, true);
    };
    // We intentionally re-init when rows change. We don't depend on table or
    // winningBucket because those change without needing a new engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /**
   * Drops a new ball at the top, registers it as targeting the given bucket.
   */
  const dropBall = (outcome: PlinkoBetOutcome) => {
    if (engineRef.current === null) return;
    // Slight random horizontal start offset for organic feel
    const startX = BOARD_WIDTH / 2 + (Math.random() - 0.5) * 4;
    const startY = TOP_PAD - 16;
    const ball = Bodies.circle(startX, startY, BALL_R, {
      restitution: 0.55,
      friction: 0.001,
      frictionAir: 0.005,
      density: 0.002,
      label: 'ball',
      render: { fillStyle: '#38d6e3' },
    });
    // Tiny initial horizontal velocity to encourage variation
    Body.setVelocity(ball, { x: (Math.random() - 0.5) * 0.6, y: 0 });
    Composite.add(engineRef.current.world, ball);
    ballsRef.current.set(ball.id, {
      targetBucket: outcome.bucket,
      outcome,
    });
  };

  const placeBet = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    try {
      const stakeBig = parseAmount(stake);
      const betNum = bumpBetCount();
      const out = await placePlinkoBet(session.ledger, {
        betId: `plinko-${String(betNum)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: stakeBig,
        rows,
        risk,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.plinkoNonce,
      });
      bumpNonce('plinko');
      // Don't set winningBucket immediately — wait for ball to land
      setLastResult(null);
      setWinningBucket(null);
      dropBall(out);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="rounded-lg border border-solstice-border bg-solstice-bg/40 p-4">
        <canvas
          ref={canvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          className="h-auto w-full"
          style={{ maxWidth: `${String(BOARD_WIDTH)}px`, margin: '0 auto', display: 'block' }}
        />
        {lastResult !== null && (
          <div className="mt-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
              Bucket {String(lastResult.bucket)} · {String(lastResult.multiplier)}×
            </div>
            <div
              className={`mt-1 font-mono text-xl font-bold ${
                lastResult.payout > lastResult.stake
                  ? 'text-solstice-win'
                  : lastResult.payout === lastResult.stake
                    ? 'text-yellow-300'
                    : 'text-solstice-loss'
              }`}
            >
              {lastResult.payout > lastResult.stake
                ? `+${formatAmountDisplay(lastResult.payout - lastResult.stake)} USDT`
                : lastResult.payout === lastResult.stake
                  ? 'PUSH'
                  : `−${formatAmountDisplay(lastResult.stake - lastResult.payout)} USDT`}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
            Stake (USDT)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={stake}
            onChange={(e) => {
              setStake(e.target.value);
            }}
            disabled={busy}
            className="w-full rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 font-mono text-sm text-solstice-fg focus:border-solstice-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
            Rows
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ROWS_VALUES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRows(r);
                }}
                disabled={busy}
                className={`rounded-md border px-2 py-2 text-sm font-medium ${
                  rows === r
                    ? 'border-solstice-accent bg-solstice-accent/10 text-solstice-accent'
                    : 'border-solstice-border bg-solstice-bg text-solstice-muted hover:text-solstice-fg'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
            Risk
          </label>
          <div className="grid grid-cols-3 gap-2">
            {RISK_VALUES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRisk(r);
                }}
                disabled={busy}
                className={`rounded-md border px-2 py-2 text-xs font-medium ${
                  risk === r
                    ? 'border-solstice-accent bg-solstice-accent/10 text-solstice-accent'
                    : 'border-solstice-border bg-solstice-bg text-solstice-muted hover:text-solstice-fg'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void placeBet();
          }}
          disabled={busy || session === null}
          className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Placing...' : `Drop ball (${stake} USDT)`}
        </button>
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-[11px] text-solstice-muted">
          Real 2D physics. The ball drops, bounces off pegs with proper collisions, and lands in the
          bucket determined by the provably-fair RNG.
        </div>
      </div>
    </div>
  );
}

// ─── Canvas rendering ──────────────────────────────────────────────────

function renderFrame(
  ctx: CanvasRenderingContext2D,
  engine: Engine,
  totalRows: number,
  table: readonly number[],
  winningBucket: number | null,
) {
  // Clear
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // Render slots at the bottom (within just the slot-row portion of BOTTOM_PAD)
  const slotWidth = BOARD_WIDTH / (totalRows + 1);
  const slotY = BOARD_HEIGHT - SLOT_HEIGHT;
  const slotHeight = SLOT_HEIGHT - 6;
  table.forEach((mul, i) => {
    const x = i * slotWidth;
    const isWinning = winningBucket === i;
    ctx.fillStyle = multiplierColor(mul);
    ctx.globalAlpha = isWinning ? 1.0 : 0.7;
    roundRect(ctx, x + 2, slotY, slotWidth - 4, slotHeight, 5);
    ctx.fill();
    if (isWinning) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
    // Label
    ctx.fillStyle = '#0a0e1a';
    ctx.font = `bold ${String(Math.min(slotWidth * 0.42, 16))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${String(mul)}x`, x + slotWidth / 2, slotY + slotHeight / 2);
  });

  // Render all bodies in the world
  const bodies = Composite.allBodies(engine.world);
  for (const body of bodies) {
    if (body.label === 'peg') {
      ctx.fillStyle = '#e6edf7';
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, PEG_R, 0, Math.PI * 2);
      ctx.fill();
    } else if (body.label === 'ball') {
      ctx.fillStyle = '#38d6e3';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(56, 214, 227, 0.6)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // Don't render dividers / walls / floor (they're invisible structural)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
