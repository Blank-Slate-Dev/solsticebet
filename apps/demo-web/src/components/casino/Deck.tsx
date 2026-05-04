// apps/demo-web/src/components/casino/Deck.tsx
//
// Visible card deck on the right side of the felt. Three layered cards with
// the same Solstice-branded back as the cards being dealt — so when a card
// "slides from the deck" it visually matches the deck pile.

import { CardBack } from './CardBack';

interface DeckProps {
  readonly size?: 'sm' | 'md';
}

export function Deck({ size = 'md' }: DeckProps) {
  return (
    <div className="relative">
      {/* Three layered cards, slightly offset to feel like a real pile */}
      <div className="absolute -bottom-1.5 -right-1.5 opacity-70">
        <CardBack size={size} />
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 opacity-90">
        <CardBack size={size} />
      </div>
      <div className="relative">
        <CardBack size={size} />
      </div>
    </div>
  );
}
