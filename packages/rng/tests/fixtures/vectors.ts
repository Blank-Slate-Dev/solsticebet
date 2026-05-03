// packages/rng/tests/fixtures/vectors.ts
//
// Canonical test vectors for HMAC-SHA256 + Stake-style float derivation.
// Generated 2026-05-03 from the spec algorithm using Node's `crypto.createHmac`.
//
// These vectors are the regression-prevention fixture: any change to the core
// derivation that produces different outputs from these vectors is a defect,
// not an improvement.
//
// If a vector ever needs to change, the change must be documented as a
// breaking change to docs/RNG.md with a version bump and migration plan.

export interface RngVector {
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly cursor: number;
  readonly hmacHex: string;
  readonly floats: readonly number[];
}

export const vectors: readonly RngVector[] = [
  {
    serverSeed: '0000000000000000000000000000000000000000000000000000000000000000',
    clientSeed: 'a',
    nonce: 0,
    cursor: 0,
    hmacHex: '0063b519243f4a7b0fb948de8f617cf152f1829de7014b3664df2247bdaf8a59',
    floats: [
      0.001521414378657937, 0.14159074309282005, 0.06142096919938922, 0.5600812996271998,
      0.32399765332229435, 0.9023634917102754, 0.39402975304983556, 0.7409597842488438,
    ],
  },
  {
    serverSeed: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    clientSeed: 'b',
    nonce: 0,
    cursor: 0,
    hmacHex: '03aa4ae3b1d563032ba187068711293987eeeefcd222a55f32c18b769ad830d7',
    floats: [
      0.014317207736894488, 0.6946622736286372, 0.17043346306309104, 0.527605606475845,
      0.5309895863756537, 0.8208411557134241, 0.19826575880870223, 0.6048613095190376,
    ],
  },
  {
    serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    clientSeed: 'default',
    nonce: 0,
    cursor: 0,
    hmacHex: 'e2a7baeb57c8b77d57aac204d8cc5e1e402349d2af0e560cec6c82dac9e726c9',
    floats: [
      0.885371858952567, 0.34290644456632435, 0.342449308373034, 0.8468684027902782,
      0.25053845765069127, 0.6838125018402934, 0.9235307485796511, 0.7886833420488983,
    ],
  },
  {
    serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    clientSeed: 'default',
    nonce: 1,
    cursor: 0,
    hmacHex: 'dd1dd05730fa62aa108f12517d6d2470e11e591500ce2a3b3af22fbaf370fcab',
    floats: [
      0.8637361729051918, 0.1913205781020224, 0.06468309857882559, 0.4899466298520565,
      0.8793693233747035, 0.003145827678963542, 0.23025797167792916, 0.9509427945595235,
    ],
  },
  {
    serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    clientSeed: 'default',
    nonce: 2,
    cursor: 0,
    hmacHex: 'd275f7aa753b28326b0e8f36431aa6f6c8703627dc9e44a29bc96621e1b5b77d',
    floats: [
      0.8221125402487814, 0.4579339143820107, 0.41819090908393264, 0.26212543016299605,
      0.782962212106213, 0.861789979506284, 0.6085418539587408, 0.8816790275741369,
    ],
  },
  {
    serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    clientSeed: 'default',
    nonce: 100,
    cursor: 0,
    hmacHex: 'bd880d1ad6acdeb8277f47f4aaa0d5b1d5e78ac869807ad7f0a78e46601cdb2e',
    floats: [
      0.7403572262264788, 0.8385752867907286, 0.1542859049513936, 0.6665166432503611,
      0.8355643022805452, 0.412116696825251, 0.9400566979311407, 0.3754403102211654,
    ],
  },
  {
    serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    clientSeed: 'default',
    nonce: 999999,
    cursor: 0,
    hmacHex: '10717ef3666f892266f0f57e6f51cc66e98299323eb4b98d7d808bed3c47204a',
    floats: [
      0.06423180992715061, 0.4001393993385136, 0.40211424184963107, 0.43484189501032233,
      0.9121490237303078, 0.2449451417196542, 0.4902427152264863, 0.23546029860153794,
    ],
  },
  {
    serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    clientSeed: 'default',
    nonce: 0,
    cursor: 1,
    hmacHex: '22a5ff208884cf3dc195a349c33b7ee5951cefe067055010233dd43da20259c7',
    floats: [
      0.13534540683031082, 0.5332765125203878, 0.7561895421240479, 0.7626265820581466,
      0.5824727937579155, 0.40242481604218483, 0.13766218652017415, 0.6328483687248081,
    ],
  },
  {
    serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    clientSeed: 'default',
    nonce: 0,
    cursor: 5,
    hmacHex: '685689747a4efd308b83dd3bc0debf43d023a4685af940ca41451ccb4282c395',
    floats: [
      0.4075704487040639, 0.47776777669787407, 0.5449808377306908, 0.7533988512586802,
      0.8130438569933176, 0.35536580020561814, 0.2549608226399869, 0.2598078001756221,
    ],
  },
  {
    serverSeed: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222',
    clientSeed: 'player-1',
    nonce: 42,
    cursor: 0,
    hmacHex: '4a68d445bf587b8dc8443715226ad4d9cd474b2f1e36906cdec1e34178639fdb',
    floats: [
      0.2906620663125068, 0.7474438876379281, 0.7822908808011562, 0.13444261834956706,
      0.8018691053148359, 0.11802008282393217, 0.8701459916774184, 0.47027014824561775,
    ],
  },
  {
    serverSeed: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222',
    clientSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    nonce: 0,
    cursor: 0,
    hmacHex: '6b57a631b0836551fa8e52e86602baba59f9fd45cf78bf3786afcdb775db93f0',
    floats: [
      0.41930617042817175, 0.689504940295592, 0.9787341896444559, 0.39847914734855294,
      0.3514707845170051, 0.8104362019803375, 0.5261200496461242, 0.46038174256682396,
    ],
  },
  {
    serverSeed: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222',
    clientSeed: '!@#$%^&*()',
    nonce: 0,
    cursor: 0,
    hmacHex: '6205218827dddc57eb1277fac85bb4d680054b9e73dfd529e770462b0ace91d9',
    floats: [
      0.3828907925635576, 0.15572907566092908, 0.9182505593635142, 0.7826493284665048,
      0.5000808010809124, 0.45263416529633105, 0.904056916711852, 0.042214503744617105,
    ],
  },
  {
    serverSeed: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222',
    clientSeed: 'My-Lucky-Seed-2026',
    nonce: 7,
    cursor: 0,
    hmacHex: 'fff612954963d1aaa4e2c9e8bbc2c46c3c55fe5e2ac531d9092fe2a0da67327a',
    floats: [
      0.9998485196847469, 0.286679367069155, 0.6440855208784342, 0.7334406627342105,
      0.23568715853616595, 0.16707145259715617, 0.03588692098855972, 0.8531371639110148,
    ],
  },
];
