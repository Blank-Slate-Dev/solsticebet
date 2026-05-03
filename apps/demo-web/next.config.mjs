// apps/demo-web/next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@solsticebet/game-baccarat',
    '@solsticebet/game-blackjack',
    '@solsticebet/game-coin-flip',
    '@solsticebet/game-crash',
    '@solsticebet/game-dice',
    '@solsticebet/game-hi-lo',
    '@solsticebet/game-keno',
    '@solsticebet/game-limbo',
    '@solsticebet/game-lucky-wheel',
    '@solsticebet/game-mines',
    '@solsticebet/game-plinko',
    '@solsticebet/game-roulette',
    '@solsticebet/game-sicbo',
    '@solsticebet/game-uth',
    '@solsticebet/ledger',
    '@solsticebet/rng',
  ],
};

export default nextConfig;
