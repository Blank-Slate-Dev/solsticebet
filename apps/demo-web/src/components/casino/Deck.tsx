// apps/demo-web/src/components/casino/Deck.tsx
//
// A small visible card deck. Cards in the felt animate "from" this position
// using transform offsets in card-deal-from-deck. The deck doesn't move but
// gives a visual origin for dealt cards.

interface DeckProps {
  /** Visual size: 'sm' for ~14×20, 'md' for ~16×24. */
  readonly size?: 'sm' | 'md';
}

export function Deck({ size = 'md' }: DeckProps) {
  const dims = size === 'sm' ? 'h-20 w-14' : 'h-24 w-16';
  return (
    <div className="relative">
      {/* Stack effect: 3 layered cards */}
      <div
        className={`absolute -bottom-1 -right-1 ${dims} rounded-md border border-solstice-border bg-gradient-to-br from-solstice-accent-deep to-solstice-bg shadow-lg`}
      />
      <div
        className={`absolute -bottom-0.5 -right-0.5 ${dims} rounded-md border border-solstice-border bg-gradient-to-br from-solstice-accent-deep to-solstice-bg shadow-lg`}
      />
      <div
        className={`relative ${dims} rounded-md border border-solstice-border bg-gradient-to-br from-solstice-accent-deep to-solstice-bg shadow-xl`}
      >
        <div className="absolute inset-2 rounded border border-solstice-accent/40 bg-solstice-accent/5" />
      </div>
    </div>
  );
}
