// apps/demo-web/src/components/DemoBanner.tsx

export function DemoBanner() {
  return (
    <div className="border-b border-yellow-500/30 bg-yellow-500/5 px-6 py-2 text-center text-xs text-yellow-200/80">
      <span className="font-semibold">DEMO</span> — in-memory session, no real money. Refresh to
      start over. The production app is a separate build.
    </div>
  );
}
