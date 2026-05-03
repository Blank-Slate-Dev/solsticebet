// apps/demo-web/src/components/LuckyWheelGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import { placeLuckyWheelBet, type LuckyWheelBetOutcome } from '@solsticebet/game-lucky-wheel';

import { useSession } from '@/lib/session-context';

const SPIN_DURATION_MS = 2400;

const SEGMENT_BG: Record<string, string> = {
  gray: 'bg-zinc-700 text-zinc-400',
  green: 'bg-green-600 text-white',
  blue: 'bg-blue-600 text-white',
  purple: 'bg-purple-600 text-white',
  red: 'bg-red-600 text-white',
  gold: 'bg-yellow-500 text-yellow-950',
};

export function LuckyWheelGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<LuckyWheelBetOutcome | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinKey, setSpinKey] = useState(0);

  const spin = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    setSpinning(true);
    setLast(null);
    setSpinKey((k) => k + 1);
    try {
      const num = bumpBetCount();
      const [out] = await Promise.all([
        placeLuckyWheelBet(session.ledger, {
          betId: `wheel-${String(num)}`,
          userAccountId: session.user,
          escrowAccountId: session.escrow,
          houseAccountId: session.house,
          stake: parseAmount(stake),
          currency: 'INTERNAL_USDT',
          serverSeed: session.serverSeed,
          clientSeed: session.clientSeed,
          nonce: session.luckyWheelNonce,
        }),
        new Promise((resolve) => setTimeout(resolve, SPIN_DURATION_MS)),
      ]);
      bumpNonce('lucky-wheel');
      setSpinning(false);
      setLast(out);
      await refresh();
    } catch (err) {
      setSpinning(false);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="flex flex-col items-center justify-center rounded-lg border border-solstice-border bg-solstice-bg/40 p-8 min-h-[320px]">
        <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
          {spinning
            ? 'Spinning...'
            : last !== null
              ? `Landed on segment ${last.segmentIndex + 1} of 54`
              : 'Spin the wheel'}
        </div>
        <div className="mt-4">
          {spinning ? (
            // While spinning: rotating multi-colored ring
            <div
              key={spinKey}
              className="wheel-spin flex h-32 w-32 items-center justify-center rounded-full border-[12px] border-solstice-accent shadow-2xl"
              style={
                {
                  '--target-rotation': '1440deg',
                  borderTopColor: '#eab308',
                  borderRightColor: '#a855f7',
                  borderBottomColor: '#dc2626',
                  borderLeftColor: '#22c55e',
                } as React.CSSProperties
              }
            />
          ) : last !== null ? (
            <div
              className={`flex h-32 w-32 items-center justify-center rounded-full border-4 border-solstice-accent text-3xl font-bold shadow-lg ${
                SEGMENT_BG[last.segment.color] ?? 'bg-zinc-700 text-zinc-300'
              } ${last.isWin ? 'win-flash' : ''}`}
            >
              {last.segment.multiplier === 0 ? '×' : `${last.segment.multiplier}×`}
            </div>
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-dashed border-solstice-border text-solstice-muted">
              ?
            </div>
          )}
        </div>
        {last !== null && !spinning && (
          <div className="mt-4 text-center">
            <div className="text-sm uppercase tracking-widest text-solstice-muted">
              {last.segment.color}
            </div>
            <div
              className={`mt-1 font-mono text-xl font-bold ${last.isWin ? 'text-solstice-win' : 'text-solstice-loss'}`}
            >
              {last.payout > last.stake
                ? `+${formatAmountDisplay(last.payout - last.stake)} USDT`
                : `−${formatAmountDisplay(last.stake)} USDT`}
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

        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-xs">
          <div className="mb-2 text-solstice-muted">Wheel composition (54 segments)</div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-zinc-400">gray (loss)</span>
              <span>30 × 0×</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400">green</span>
              <span>12 × 1.5×</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">blue</span>
              <span>7 × 1.7×</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-400">purple</span>
              <span>3 × 2×</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-400">red</span>
              <span>1 × 3×</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-400">gold</span>
              <span>1 × 50×</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void spin();
          }}
          disabled={busy || session === null}
          className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Spinning...' : `Spin (${stake} USDT)`}
        </button>
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
      </div>
    </div>
  );
}
