// apps/demo-web/src/components/RouletteGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  colorOf,
  PAYOUTS,
  placeRouletteSpin,
  type RouletteBet,
  type RouletteBetType,
  type RouletteSpinOutcome,
} from '@solsticebet/game-roulette';

import { useSession } from '@/lib/session-context';

interface QueuedBet {
  readonly id: number;
  readonly type: RouletteBetType;
  readonly stake: bigint;
  readonly target?: number;
  readonly label: string;
}

const COLOR_FOR_NUMBER: Record<number, 'red' | 'black' | 'green'> = (() => {
  const out: Record<number, 'red' | 'black' | 'green'> = {};
  for (let i = 0; i <= 36; i++) {
    out[i] = colorOf(i);
  }
  return out;
})();

export function RouletteGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [bets, setBets] = useState<QueuedBet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RouletteSpinOutcome | null>(null);
  const [nextBetId, setNextBetId] = useState(0);

  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0n);

  const addBet = (type: RouletteBetType, label: string, target?: number) => {
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

  const spin = async () => {
    if (session === null || bets.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const betNum = bumpBetCount();
      const apiBets: RouletteBet[] = bets.map((b) => ({
        type: b.type,
        stake: b.stake,
        ...(b.target !== undefined ? { target: b.target } : {}),
      }));
      const out = await placeRouletteSpin(session.ledger, {
        spinId: `roulette-${String(betNum)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        bets: apiBets,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.rouletteNonce,
      });
      bumpNonce('roulette');
      setLastResult(out);
      setBets([]);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      {/* Wheel + result display */}
      <div className="space-y-4 rounded-lg border border-solstice-border bg-solstice-bg/40 p-6">
        {lastResult !== null ? (
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-solstice-muted">Result</div>
            <div
              className={`mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold ${
                lastResult.resultColor === 'red'
                  ? 'bg-red-600 text-white'
                  : lastResult.resultColor === 'black'
                    ? 'bg-zinc-900 text-white ring-1 ring-solstice-border'
                    : 'bg-green-600 text-white'
              }`}
            >
              {lastResult.result}
            </div>
            <div className="mt-2 text-sm uppercase tracking-widest text-solstice-muted">
              {lastResult.resultColor}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-solstice-border bg-solstice-card p-2">
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Total staked
                </div>
                <div className="font-mono">{formatAmountDisplay(lastResult.totalStake)} USDT</div>
              </div>
              <div className="rounded-md border border-solstice-border bg-solstice-card p-2">
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Total payout
                </div>
                <div
                  className={`font-mono ${
                    lastResult.totalPayout > lastResult.totalStake
                      ? 'text-solstice-win'
                      : lastResult.totalPayout === lastResult.totalStake
                        ? 'text-yellow-300'
                        : 'text-solstice-loss'
                  }`}
                >
                  {formatAmountDisplay(lastResult.totalPayout)} USDT
                </div>
              </div>
            </div>
            {lastResult.bets.length > 0 && (
              <div className="mt-4 rounded-md border border-solstice-border bg-solstice-card p-3 text-left text-xs">
                <div className="mb-2 text-[10px] uppercase tracking-widest text-solstice-muted">
                  Per-bet outcome
                </div>
                <div className="space-y-1">
                  {lastResult.bets.map((b, i) => (
                    <div
                      key={i}
                      className={`flex justify-between ${
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
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-solstice-muted">
            Pick bet types from the right, then spin.
          </p>
        )}

        {/* Number grid for straight-up bets */}
        <div className="border-t border-solstice-border pt-4">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-solstice-muted">
            Straight-up bets (35:1)
          </div>
          <div className="grid grid-cols-12 gap-1">
            <button
              type="button"
              onClick={() => {
                addBet('straight', '0', 0);
              }}
              disabled={busy}
              className={`col-span-12 rounded-md py-2 text-xs font-bold transition ${
                lastResult?.result === 0
                  ? 'bg-green-600 text-white ring-2 ring-solstice-accent'
                  : 'bg-green-600/40 text-white hover:bg-green-600'
              }`}
            >
              0
            </button>
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
              const c = COLOR_FOR_NUMBER[n];
              const isWinning = lastResult?.result === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    addBet('straight', String(n), n);
                  }}
                  disabled={busy}
                  className={`rounded py-2 text-xs font-bold transition ${
                    isWinning
                      ? 'ring-2 ring-solstice-accent ' +
                        (c === 'red' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white')
                      : c === 'red'
                        ? 'bg-red-600/40 text-white hover:bg-red-600'
                        : 'bg-zinc-900/60 text-white hover:bg-zinc-900'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bet builder + queue + spin */}
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

        {/* Even-money bet buttons */}
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
            Even money (1:1)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['red', 'Red', 'red'],
                ['black', 'Black', 'black'],
                ['even', 'Even', 'gray'],
                ['odd', 'Odd', 'gray'],
                ['low', '1–18', 'gray'],
                ['high', '19–36', 'gray'],
              ] as const
            ).map(([type, label, accent]) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  addBet(type, label);
                }}
                disabled={busy}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  accent === 'red'
                    ? 'border-red-600/40 bg-red-600/20 text-red-200 hover:bg-red-600/40'
                    : accent === 'black'
                      ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                      : 'border-solstice-border bg-solstice-card text-solstice-fg hover:border-solstice-accent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Dozens (2:1) */}
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
            Dozens (2:1)
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  addBet('dozen', `Dozen ${d}`, d);
                }}
                disabled={busy}
                className="rounded-md border border-solstice-border bg-solstice-card px-2 py-2 text-xs font-medium text-solstice-fg hover:border-solstice-accent"
              >
                {d === 1 ? '1–12' : d === 2 ? '13–24' : '25–36'}
              </button>
            ))}
          </div>
        </div>

        {/* Columns (2:1) */}
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
            Columns (2:1)
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  addBet('column', `Col ${c}`, c);
                }}
                disabled={busy}
                className="rounded-md border border-solstice-border bg-solstice-card px-2 py-2 text-xs font-medium text-solstice-fg hover:border-solstice-accent"
              >
                Col {c}
              </button>
            ))}
          </div>
        </div>

        {/* Bet queue */}
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
                  <span className="text-solstice-fg">
                    {b.label} <span className="text-solstice-muted">({PAYOUTS[b.type]}:1)</span>
                  </span>
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
            void spin();
          }}
          disabled={busy || bets.length === 0 || session === null}
          className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
        >
          {busy
            ? 'Spinning...'
            : bets.length === 0
              ? 'Queue at least one bet'
              : `Spin (${formatAmountDisplay(totalStaked)} USDT)`}
        </button>
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
      </div>
    </div>
  );
}
