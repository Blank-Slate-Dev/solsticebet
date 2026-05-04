// apps/demo-web/src/components/casino/CasinoCard.tsx
//
// Casino playing card. Uses the Web Animations API (element.animate()) to
// drive the deal-from-deck animation directly from JS, bypassing any CSS
// class / specificity / cache concerns.

import { useEffect, useRef } from 'react';

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const SUIT_GLYPHS = ['♠', '♥', '♦', '♣'] as const;

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? '?';
}
export function suitGlyph(suit: number): string {
  return SUIT_GLYPHS[suit] ?? '?';
}
export function isRedSuit(suit: number): boolean {
  return suit === 1 || suit === 2;
}

interface CasinoCardProps {
  readonly rank: number | null;
  readonly suit?: number;
  readonly faceDown?: boolean;
  readonly highlight?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly dealFromX?: number;
  readonly dealFromY?: number;
  readonly delay?: number;
  readonly animKey?: string | number;
}

export function CasinoCard({
  rank,
  suit,
  faceDown = false,
  highlight = false,
  size = 'md',
  dealFromX,
  dealFromY,
  delay,
  animKey,
}: CasinoCardProps) {
  const dims = size === 'lg' ? 'h-24 w-16' : size === 'sm' ? 'h-12 w-9' : 'h-20 w-14';
  const rankSize = size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm';
  const suitSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-2xl';

  // Imperative animation via Web Animations API. Triggers when the element
  // mounts AND when animKey changes.
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (dealFromX === undefined) return;
    const el = ref.current;
    if (el === null) return;
    // Use Web Animations API — runs the animation directly on the element,
    // bypassing CSS class / specificity / cache concerns.
    const animation = el.animate(
      [
        {
          transform: `translate(${String(dealFromX)}px, ${String(dealFromY ?? 0)}px) rotate(15deg) scale(0.85)`,
          opacity: 0,
        },
        {
          transform: `translate(${String(dealFromX)}px, ${String(dealFromY ?? 0)}px) rotate(15deg) scale(0.85)`,
          opacity: 1,
          offset: 0.2,
        },
        {
          transform: 'translate(0, 0) rotate(0deg) scale(1)',
          opacity: 1,
        },
      ],
      {
        duration: 700,
        delay: delay ?? 0,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'both',
      },
    );
    return () => {
      animation.cancel();
    };
    // animKey is intentionally a dependency to replay the animation on key change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  if (faceDown) {
    return (
      <div
        className={`${dims} relative flex items-center justify-center rounded-md border border-solstice-accent/60 bg-gradient-to-br from-solstice-accent-deep via-[#0e1a3b] to-solstice-bg shadow-md`}
      >
        <div className="absolute inset-1.5 rounded border border-solstice-accent/40">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-6 w-6">
              <div className="absolute inset-0 rounded-full border-2 border-solstice-accent/70" />
              <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-solstice-accent/40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (rank === null) {
    return null;
  }

  const red = suit !== undefined && isRedSuit(suit);

  // The card front content
  const front = (
    <div
      className={`flex h-full w-full flex-col items-center ${
        size === 'sm' ? 'justify-center' : 'justify-between'
      } rounded-md border bg-white p-1 text-black shadow-lg ${
        highlight ? 'border-solstice-accent ring-2 ring-solstice-accent/50' : 'border-zinc-300'
      }`}
    >
      <div className={`${rankSize} font-bold ${red ? 'text-red-600' : 'text-zinc-900'}`}>
        {rankLabel(rank)}
      </div>
      {size !== 'sm' && (
        <>
          <div className={`${suitSize} ${red ? 'text-red-600' : 'text-zinc-900'}`}>
            {suit !== undefined ? suitGlyph(suit) : ''}
          </div>
          <div
            className={`rotate-180 ${rankSize} font-bold ${red ? 'text-red-600' : 'text-zinc-900'}`}
          >
            {rankLabel(rank)}
          </div>
        </>
      )}
    </div>
  );

  // No animation: cards already on the table.
  if (dealFromX === undefined) {
    return <div className={`${dims} relative`}>{front}</div>;
  }

  // Animated: imperative Web Animations API runs in the effect above.
  return (
    <div className={`${dims} relative`}>
      <div ref={ref} className="h-full w-full">
        {front}
      </div>
    </div>
  );
}
