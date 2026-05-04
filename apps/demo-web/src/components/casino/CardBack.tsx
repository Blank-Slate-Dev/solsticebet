// apps/demo-web/src/components/casino/CardBack.tsx
//
// The Solstice-branded card back used on dealer hole cards, the deck stack,
// and during the deal animation (before flipping face-up).

interface CardBackProps {
  readonly size?: 'sm' | 'md' | 'lg';
}

export function CardBack({ size = 'md' }: CardBackProps) {
  const dims = size === 'lg' ? 'h-24 w-16' : size === 'sm' ? 'h-12 w-9' : 'h-20 w-14';
  return (
    <div
      className={`relative ${dims} rounded-md border border-solstice-accent/60 bg-gradient-to-br from-solstice-accent-deep via-[#0e1a3b] to-solstice-bg shadow-md`}
    >
      {/* Inner frame */}
      <div className="absolute inset-1.5 rounded border border-solstice-accent/40">
        {/* Centered Solstice mark — a stylized sun/moon arc */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-6 w-6">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-2 border-solstice-accent/70" />
            {/* Half-circle inset (moon-like) */}
            <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-solstice-accent/40" />
          </div>
        </div>
      </div>
      {/* Faint diagonal sheen */}
      <div className="absolute inset-0 rounded-md bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
    </div>
  );
}
