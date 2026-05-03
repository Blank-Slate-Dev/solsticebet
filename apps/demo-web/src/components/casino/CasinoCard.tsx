// apps/demo-web/src/components/casino/CasinoCard.tsx
//
// A casino playing card. Optionally animates from the deck position when
// `dealFromDeck` and `cardIndex` are provided (each card staggered slightly
// later than the previous).

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
  /** Card rank 0..12. */
  readonly rank: number | null;
  /** Optional suit 0..3. Omit for suitless games (Baccarat/Blackjack/Hi-Lo). */
  readonly suit?: number;
  readonly faceDown?: boolean;
  readonly highlight?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  /** If set, card animates from this offset (deck position). */
  readonly dealFromX?: number;
  readonly dealFromY?: number;
  /** Stagger delay in ms. */
  readonly delay?: number;
  /** Animation key — when changes, replays the deal. */
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

  const animStyle: Record<string, string | number> = {};
  if (dealFromX !== undefined) {
    animStyle['--deal-from-x'] = `${String(dealFromX)}px`;
  }
  if (dealFromY !== undefined) {
    animStyle['--deal-from-y'] = `${String(dealFromY)}px`;
  }
  if (delay !== undefined) animStyle.animationDelay = `${String(delay)}ms`;
  // When dealing from deck: start invisible so the pre-animation state isn't
  // visible at the destination during the delay window.
  if (delay !== undefined && delay > 0) {
    animStyle.opacity = 0;
  }

  const animClass = dealFromX !== undefined ? 'card-deal-from-deck' : 'card-flip-in';

  if (faceDown || rank === null) {
    return (
      <div className="perspective-[1000px]">
        <div
          key={animKey}
          style={animStyle as React.CSSProperties}
          className={`${animClass} flex ${dims} items-center justify-center rounded-md border border-solstice-border bg-gradient-to-br from-solstice-accent-deep to-solstice-bg shadow-md`}
        >
          <div className="h-2/3 w-2/3 rounded border border-solstice-accent/40 bg-solstice-accent/10" />
        </div>
      </div>
    );
  }

  const red = suit !== undefined && isRedSuit(suit);
  return (
    <div className="perspective-[1000px]">
      <div
        key={animKey}
        style={animStyle as React.CSSProperties}
        className={`${animClass} flex ${dims} flex-col items-center ${
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
    </div>
  );
}
