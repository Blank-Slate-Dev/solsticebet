// apps/demo-web/next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages so Next can bundle their TS source.
  transpilePackages: [
    '@solsticebet/game-baccarat',
    '@solsticebet/game-blackjack',
    '@solsticebet/game-dice',
    '@solsticebet/game-mines',
    '@solsticebet/game-plinko',
    '@solsticebet/game-roulette',
    '@solsticebet/ledger',
    '@solsticebet/rng',
  ],
};

export default nextConfig;
