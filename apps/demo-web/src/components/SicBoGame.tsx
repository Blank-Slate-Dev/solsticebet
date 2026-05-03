// apps/demo-web/src/components/SicBoGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  placeSicBoRoll,
  TOTAL_PAYOUTS,
  type SicBoBet,
  type SicBoBetType,
  type SicBoRollOutcome,
} from '@solsticebet/game-sicbo';

import { useSession } from '@/lib/session-context';

interface QueuedBet {
  readonly id: number;
  readonly type: SicBoBetType;
  readonly stake: bigint;
  readonly target?: number | readonly [number, number];
  readonly label: string;
}

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'] as const;

function diceFace(n: number): string {
  return DICE_FACES[n] ?? '?';
}

function Die({
  value,
  highlight = false,
  tumbling = false,
  tumbleKey,
}: {
  value: number;
  highlight?: boolean;
  tumbling?: boolean;
  tumbleKey?: number;
}) {
  return (
    <div className="perspective-[600px]">
      <div
        key={tumbleKey}
        className={`flex h-20 w-20 items-center justify-center rounded-lg border bg-white text-6xl text-black shadow-lg transition ${
          highlight ? 'border-solstice-accent ring-2 ring-solstice-accent/50' : 'border-zinc-300'
        } ${tumbling ? 'dice-tumble' : ''}`}
      >
        {diceFace(value)}
      </div>
    </div>
  );
}

export function SicBoGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [bets, setBets] = useState<QueuedBet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SicBoRollOutcome | null>(null);
  const [nextBetId, setNextBetId] = useState(0);
  const [tumbling, setTumbling] = useState(false);
  const [tumbleKey, setTumbleKey] = useState(0);

  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0n);

  const addBet = (
    type: SicBoBetType,
    label: string,
    target?: number | readonly [number, number],
  ) => {
    setError(null);
    let stakeBig: bigint;
    try {
      stakeBig = parseAmount(stake);
    } catch (err) {
      setError(`Invalid stake: ${(err as Error).message}`);
      return;
    }
    const newBet: QueuedBet = {
      id: nextBetId,
      type,
      stake: stakeBig,
      label,
      ...(target !== undefined ? { target } : {}),
    };
    setBets((b) => [...b, newBet]);
    setNextBetId((n) => n + 1);
  };

  const removeBet = (id: number) => {
    setBets((b) => b.filter((bet) => bet.id !== id));
  };

  const clearBets = () => {
    setBets([]);
    setLastResult(null);
  };

  const roll = async () => {
    if (session === null || bets.length === 0) return;
    setError(null);
    setBusy(true);
    setLastResult(null);
    setTumbling(true);
    setTumbleKey((k) => k + 1);
    try {
      const num = bumpBetCount();
      const apiBets: SicBoBet[] = bets.map((b) => ({
        type: b.type,
        stake: b.stake,
        ...(b.target !== undefined ? { target: b.target } : {}),
      }));
      const [out] = await Promise.all([
        placeSicBoRoll(session.ledger, {
          rollId: `sicbo-${String(num)}`,
          userAccountId: session.user,
          escrowAccountId: session.escrow,
          houseAccountId: session.house,
          bets: apiBets,
          currency: 'INTERNAL_USDT',
          serverSeed: session.serverSeed,
          clientSeed: session.clientSeed,
          nonce: session.sicboNonce,
        }),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
      bumpNonce('sicbo');
      setTumbling(false);
      setLastResult(out);
      setBets([]);
      await refresh();
    } catch (err) {
      setTumbling(false);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const dice = lastResult?.dice;
  const total = lastResult?.total;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Dice + result display + betting board */}
      <div className="space-y-4 rounded-lg border border-solstice-border bg-solstice-bg/40 p-4">
        {/* Dice */}
        <div className="flex flex-col items-center justify-center rounded-md border border-solstice-border bg-solstice-card/40 p-6">
          {tumbling ? (
            <div className="flex gap-3">
              <Die value={1} tumbling tumbleKey={tumbleKey} />
              <Die value={1} tumbling tumbleKey={tumbleKey} />
              <Die value={1} tumbling tumbleKey={tumbleKey} />
            </div>
          ) : dice !== undefined ? (
            <>
              <div className="flex gap-3">
                <Die value={dice[0]} highlight />
                <Die value={dice[1]} highlight />
                <Die value={dice[2]} highlight />
              </div>
              <div className="mt-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Total
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums">{total}</div>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-solstice-muted">Place bets and roll</p>
          )}
        </div>

        {/* Per-bet outcome panel */}
        {lastResult !== null && (
          <div className="rounded-md border border-solstice-border bg-solstice-card/40 p-3 text-xs">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-solstice-muted">
              Per-bet outcome
            </div>
            <div className="space-y-1">
              {lastResult.bets.map((b, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between ${
                    b.isWin ? 'text-solstice-win' : 'text-solstice-muted'
                  }`}
                >
                  <span>
                    {b.type}
                    {b.target !== null
                      ? ` (${Array.isArray(b.target) ? b.target.join(',') : String(b.target)})`
                      : ''}
                  </span>
                  <span className="font-mono">
                    {formatAmountDisplay(b.stake)} →{' '}
                    {b.isWin
                      ? `+${formatAmountDisplay(b.payout - b.stake)}`
                      : `−${formatAmountDisplay(b.stake)}`}
                  </span>
                </div>
              ))}
              <div className="mt-1 border-t border-solstice-border pt-1 text-solstice-muted">
                Net:{' '}
                <span
                  className={`font-mono ${
                    lastResult.totalPayout > lastResult.totalStake
                      ? 'text-solstice-win'
                      : lastResult.totalPayout === lastResult.totalStake
                        ? 'text-yellow-300'
                        : 'text-solstice-loss'
                  }`}
                >
                  {lastResult.totalPayout > lastResult.totalStake ? '+' : ''}
                  {formatAmountDisplay(lastResult.totalPayout - lastResult.totalStake)} USDT
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Betting board */}
        <div className="space-y-3">
          {/* Even-money */}
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
              Even money (1:1, lose on triples)
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  addBet('small', 'Small');
                }}
                disabled={busy}
                className="rounded-md border border-solstice-border bg-solstice-card px-3 py-2 text-sm font-medium text-solstice-fg hover:border-solstice-accent"
              >
                Small (4–10)
              </button>
              <button
                type="button"
                onClick={() => {
                  addBet('big', 'Big');
                }}
                disabled={busy}
                className="rounded-md border border-solstice-border bg-solstice-card px-3 py-2 text-sm font-medium text-solstice-fg hover:border-solstice-accent"
              >
                Big (11–17)
              </button>
              <button
                type="button"
                onClick={() => {
                  addBet('even', 'Even');
                }}
                disabled={busy}
                className="rounded-md border border-solstice-border bg-solstice-card px-3 py-2 text-sm font-medium text-solstice-fg hover:border-solstice-accent"
              >
                Even
              </button>
              <button
                type="button"
                onClick={() => {
                  addBet('odd', 'Odd');
                }}
                disabled={busy}
                className="rounded-md border border-solstice-border bg-solstice-card px-3 py-2 text-sm font-medium text-solstice-fg hover:border-solstice-accent"
              >
                Odd
              </button>
            </div>
          </div>

          {/* Totals */}
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
              Total (sum of dice)
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 14 }, (_, i) => i + 4).map((t) => {
                const pay = TOTAL_PAYOUTS[t] ?? 0;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      addBet('total', `Total=${String(t)}`, t);
                    }}
                    disabled={busy}
                    className="rounded border border-solstice-border bg-solstice-card px-1 py-1 text-center hover:border-solstice-accent"
                  >
                    <div className="font-mono text-sm font-bold">{t}</div>
                    <div className="text-[9px] text-solstice-muted">{pay}:1</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Triples */}
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
              Triples
            </div>
            <div className="grid grid-cols-7 gap-1">
              <button
                type="button"
                onClick={() => {
                  addBet('any_triple', 'Any triple');
                }}
                disabled={busy}
                className="rounded border border-yellow-500/40 bg-yellow-500/10 px-2 py-1.5 text-center text-yellow-200 hover:bg-yellow-500/20"
              >
                <div className="text-[10px] font-medium">Any</div>
                <div className="text-[9px] text-solstice-muted">30:1</div>
              </button>
              {Array.from({ length: 6 }, (_, i) => i + 1).map((face) => (
                <button
                  key={face}
                  type="button"
                  onClick={() => {
                    addBet('specific_triple', `Triple ${diceFace(face)}`, face);
                  }}
                  disabled={busy}
                  className="rounded border border-yellow-500/40 bg-yellow-500/5 px-1 py-1.5 text-center hover:bg-yellow-500/15"
                >
                  <div className="text-lg leading-none">{diceFace(face)}</div>
                  <div className="text-[9px] text-solstice-muted">180:1</div>
                </button>
              ))}
            </div>
          </div>

          {/* Doubles */}
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
              Doubles (≥2 matching)
            </div>
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 6 }, (_, i) => i + 1).map((face) => (
                <button
                  key={face}
                  type="button"
                  onClick={() => {
                    addBet('specific_double', `Double ${diceFace(face)}`, face);
                  }}
                  disabled={busy}
                  className="rounded border border-purple-500/40 bg-purple-500/10 px-1 py-1.5 text-center hover:bg-purple-500/20"
                >
                  <div className="text-lg leading-none">{diceFace(face)}</div>
                  <div className="text-[9px] text-solstice-muted">10:1</div>
                </button>
              ))}
            </div>
          </div>

          {/* Single die */}
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
              Single die (1:1 / 2:1 / 3:1 by match count)
            </div>
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 6 }, (_, i) => i + 1).map((face) => (
                <button
                  key={face}
                  type="button"
                  onClick={() => {
                    addBet('single_die', `Single ${diceFace(face)}`, face);
                  }}
                  disabled={busy}
                  className="rounded border border-solstice-accent/40 bg-solstice-accent/10 px-1 py-1.5 text-center hover:bg-solstice-accent/20"
                >
                  <div className="text-lg leading-none">{diceFace(face)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bet builder + queue + roll */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
            Stake per bet (USDT)
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

        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
              Queued bets ({bets.length})
            </div>
            {bets.length > 0 && (
              <button
                type="button"
                onClick={clearBets}
                disabled={busy}
                className="text-[10px] uppercase tracking-wider text-solstice-muted hover:text-solstice-loss"
              >
                Clear
              </button>
            )}
          </div>
          {bets.length === 0 ? (
            <p className="text-xs text-solstice-muted">No bets queued.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {bets.map((b) => (
                <li key={b.id} className="flex items-center justify-between">
                  <span className="text-solstice-fg">{b.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-solstice-fg">
                      {formatAmountDisplay(b.stake)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        removeBet(b.id);
                      }}
                      disabled={busy}
                      className="text-solstice-muted hover:text-solstice-loss"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
              <li className="border-t border-solstice-border pt-1 text-solstice-muted">
                Total: {formatAmountDisplay(totalStaked)} USDT
              </li>
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            void roll();
          }}
          disabled={busy || bets.length === 0 || session === null}
          className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
        >
          {busy
            ? 'Rolling...'
            : bets.length === 0
              ? 'Queue at least one bet'
              : `Roll dice (${formatAmountDisplay(totalStaked)} USDT)`}
        </button>
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}

        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-[11px] text-solstice-muted">
          <p className="mb-1 font-semibold text-solstice-fg">Sic Bo at a glance</p>
          <p>
            Three dice rolled at once. Bet on totals, triples, doubles, single faces, or simple
            even-money (Big/Small/Even/Odd). Best odds are on even-money bets (~97.2% RTP).
          </p>
        </div>
      </div>
    </div>
  );
}
