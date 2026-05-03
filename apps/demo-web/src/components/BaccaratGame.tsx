// apps/demo-web/src/components/BaccaratGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  PAYOUTS,
  placeBaccaratCoup,
  pointValueOf,
  type BaccaratBet,
  type BaccaratBetType,
  type BaccaratCoupOutcome,
} from '@solsticebet/game-baccarat';

import { useSession } from '@/lib/session-context';

interface QueuedBet {
  readonly id: number;
  readonly type: BaccaratBetType;
  readonly stake: bigint;
}

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

function cardLabel(rank: number): string {
  return RANK_LABELS[rank] ?? '?';
}

function CardChip({ rank, highlight = false }: { rank: number; highlight?: boolean }) {
  return (
    <div
      className={`flex h-16 w-12 flex-col items-center justify-center rounded-md border text-xs font-bold transition ${
        highlight
          ? 'border-solstice-accent bg-solstice-card text-solstice-fg shadow-lg shadow-solstice-accent/30'
          : 'border-solstice-border bg-solstice-card text-solstice-fg'
      }`}
    >
      <span className="text-2xl">{cardLabel(rank)}</span>
      <span className="text-[10px] text-solstice-muted">{pointValueOf(rank)}pt</span>
    </div>
  );
}

export function BaccaratGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [bets, setBets] = useState<QueuedBet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BaccaratCoupOutcome | null>(null);
  const [nextBetId, setNextBetId] = useState(0);

  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0n);

  const queueBet = (type: BaccaratBetType) => {
    setError(null);
    if (bets.some((b) => b.type === type)) {
      setError(`Already have a ${type} bet queued. Remove it first.`);
      return;
    }
    let stakeBig: bigint;
    try {
      stakeBig = parseAmount(stake);
    } catch (err) {
      setError(`Invalid stake: ${(err as Error).message}`);
      return;
    }
    setBets((b) => [...b, { id: nextBetId, type, stake: stakeBig }]);
    setNextBetId((n) => n + 1);
  };

  const removeBet = (id: number) => {
    setBets((b) => b.filter((bet) => bet.id !== id));
  };

  const clearBets = () => {
    setBets([]);
    setLastResult(null);
  };

  const deal = async () => {
    if (session === null || bets.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const coupNum = bumpBetCount();
      const apiBets: BaccaratBet[] = bets.map((b) => ({
        type: b.type,
        stake: b.stake,
      }));
      const out = await placeBaccaratCoup(session.ledger, {
        coupId: `baccarat-${String(coupNum)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        bets: apiBets,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.baccaratNonce,
      });
      bumpNonce('baccarat');
      setLastResult(out);
      setBets([]);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const winnerColor = (winner: 'player' | 'banker' | 'tie' | null): string => {
    if (winner === 'player') return 'text-solstice-win';
    if (winner === 'banker') return 'text-red-400';
    if (winner === 'tie') return 'text-yellow-300';
    return 'text-solstice-muted';
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      {/* Table layout */}
      <div className="space-y-4 rounded-lg border border-solstice-border bg-solstice-bg/40 p-6">
        {lastResult !== null ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                Winner
              </div>
              <div
                className={`mt-1 text-3xl font-bold capitalize ${winnerColor(lastResult.deal.winner)}`}
              >
                {lastResult.deal.winner}
                {lastResult.deal.natural && (
                  <span className="ml-2 text-sm text-yellow-300">(natural)</span>
                )}
              </div>
            </div>

            {/* Two hands */}
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`rounded-md border p-3 ${
                  lastResult.deal.winner === 'player'
                    ? 'border-solstice-win bg-solstice-win/10'
                    : 'border-solstice-border bg-solstice-card/40'
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Player
                </div>
                <div className="mt-1 mb-2 font-mono text-2xl font-bold">
                  {lastResult.deal.player.total}
                </div>
                <div className="flex gap-1">
                  {lastResult.deal.player.cards.map((rank, i) => (
                    <CardChip key={i} rank={rank} highlight={lastResult.deal.winner === 'player'} />
                  ))}
                </div>
              </div>
              <div
                className={`rounded-md border p-3 ${
                  lastResult.deal.winner === 'banker'
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-solstice-border bg-solstice-card/40'
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Banker
                </div>
                <div className="mt-1 mb-2 font-mono text-2xl font-bold">
                  {lastResult.deal.banker.total}
                </div>
                <div className="flex gap-1">
                  {lastResult.deal.banker.cards.map((rank, i) => (
                    <CardChip key={i} rank={rank} highlight={lastResult.deal.winner === 'banker'} />
                  ))}
                </div>
              </div>
            </div>

            {/* Per-bet outcomes */}
            <div className="rounded-md border border-solstice-border bg-solstice-card/40 p-3">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-solstice-muted">
                Per-bet outcome
              </div>
              <div className="space-y-1 text-xs">
                {lastResult.bets.map((b, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between ${
                      b.state === 'win'
                        ? 'text-solstice-win'
                        : b.state === 'push'
                          ? 'text-yellow-300'
                          : 'text-solstice-muted'
                    }`}
                  >
                    <span className="capitalize">{b.type}</span>
                    <span className="font-mono">
                      {formatAmountDisplay(b.stake)} →{' '}
                      {b.state === 'win'
                        ? `+${formatAmountDisplay(b.payout - b.stake)}`
                        : b.state === 'push'
                          ? 'push (refund)'
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
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-solstice-muted">
            Bet on Player, Banker, or Tie. Cards deal automatically — no decisions to make.
          </p>
        )}
      </div>

      {/* Bet builder */}
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
          <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
            Place bets
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                queueBet('player');
              }}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-md border border-blue-600/40 bg-blue-600/10 px-3 py-2 text-sm font-medium text-blue-200 hover:bg-blue-600/20"
            >
              <span>Player</span>
              <span className="text-xs text-solstice-muted">{PAYOUTS.player}:1</span>
            </button>
            <button
              type="button"
              onClick={() => {
                queueBet('banker');
              }}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-md border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-600/20"
            >
              <span>Banker</span>
              <span className="text-xs text-solstice-muted">{PAYOUTS.banker}:1</span>
            </button>
            <button
              type="button"
              onClick={() => {
                queueBet('tie');
              }}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm font-medium text-yellow-200 hover:bg-yellow-500/20"
            >
              <span>Tie</span>
              <span className="text-xs text-solstice-muted">{PAYOUTS.tie}:1</span>
            </button>
          </div>
        </div>

        {/* Bet queue */}
        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
              Queued ({bets.length}/3)
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
                  <span className="capitalize text-solstice-fg">{b.type}</span>
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
            void deal();
          }}
          disabled={busy || bets.length === 0 || session === null}
          className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
        >
          {busy
            ? 'Dealing...'
            : bets.length === 0
              ? 'Queue at least one bet'
              : `Deal (${formatAmountDisplay(totalStaked)} USDT)`}
        </button>
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
      </div>
    </div>
  );
}
