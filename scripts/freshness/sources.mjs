// scripts/freshness/sources.mjs
// Each source: id, label, kind, and the args needed to fetch its marker.
// kind 'release' -> latest release tag; 'commit' -> default-branch HEAD sha;
// 'files' -> blob shas of named files at a ref (content, not every push);
// 'page' -> Last-Modified/hash, or a named content fingerprint when the headers lie;
// 'endpoint' -> one scalar from a live service's JSON (the deployment, not the repo).
export const SOURCES = [
  // Header-based markers are useless here: docs.sui.io rotates Last-Modified AND
  // ETag on every CDN rebuild, so this source produced two consecutive false drifts
  // (2026-09-03, 2026-09-04) with byte-identical release content. Fingerprint the
  // release list instead — see PAGE_FINGERPRINTS['sui-release-notes'].
  { id: 'docs-release-notes', label: 'docs.sui.io/release-notes', kind: 'page', fingerprint: 'sui-release-notes', url: 'https://docs.sui.io/references/release-notes' },
  { id: 'docs-sui-stack',     label: 'docs.sui.io/sui-stack',     kind: 'page', url: 'https://docs.sui.io/sui-stack' },
  { id: 'sui',                label: 'MystenLabs/sui',                repo: 'MystenLabs/sui',                kind: 'release' },
  // ts-sdks monorepo stopped cutting GitHub releases (frozen at Apr 2026) — watch npm directly.
  // kind 'npm' -> marker = space-joined pkg@latest list; drifts when ANY tracked SDK publishes.
  { id: 'npm-sdks',           label: 'npm @mysten/* SDK versions',    kind: 'npm', pkgs: [
    '@mysten/sui', '@mysten/dapp-kit-core', '@mysten/dapp-kit-react', '@mysten/deepbook-v3',
    '@mysten/enoki', '@mysten/kiosk', '@mysten/messaging', '@mysten/seal', '@mysten/suins',
    '@mysten/wallet-standard', '@mysten/walrus', '@mysten/zksend',
  ] },
  { id: 'walrus',             label: 'MystenLabs/walrus',             repo: 'MystenLabs/walrus',             kind: 'release' },
  { id: 'seal',               label: 'MystenLabs/seal',               repo: 'MystenLabs/seal',               kind: 'release' },
  { id: 'deepbookv3',         label: 'MystenLabs/deepbookv3',         repo: 'MystenLabs/deepbookv3',         kind: 'release' },
  { id: 'nautilus',           label: 'MystenLabs/nautilus',           repo: 'MystenLabs/nautilus',           kind: 'release' },
  { id: 'suins-contracts',    label: 'MystenLabs/suins-contracts',    repo: 'MystenLabs/suins-contracts',    kind: 'release' },
  { id: 'move-book',          label: 'MystenLabs/move-book',          repo: 'MystenLabs/move-book',          kind: 'commit', branch: 'main' },
  { id: 'sui-dev-skills',     label: 'MystenLabs/sui-dev-skills',     repo: 'MystenLabs/sui-dev-skills',     kind: 'commit', branch: 'main' },
  { id: 'move-code-review',   label: 'MystenLabs/move-code-review-skill', repo: 'MystenLabs/move-code-review-skill', kind: 'commit', branch: 'main' },
  { id: 'sagat',              label: 'MystenLabs/sagat',              repo: 'MystenLabs/sagat',              kind: 'commit', branch: 'main' },
  { id: 'sui-stack-messaging',label: 'MystenLabs/sui-stack-messaging',repo: 'MystenLabs/sui-stack-messaging',kind: 'commit', branch: 'main' },
  // Deliberately NOT `kind: 'commit'` on `dev`: that branch moves dozens of commits
  // between any change to the material this repo cites, so a HEAD marker drifted on
  // work no reader of ours could act on. These three blobs ARE what
  // skills/sui-walrus/references/memory.md is pinned to — upstream's canonical
  // SKILL.md (the target of our errata), the machine-readable docs index, and the
  // official Claude Code plugin manifest we tell readers to install instead of
  // hand-wiring hooks. `dev` stays the ref because it is the repo's default branch,
  // i.e. what a reader following our links actually lands on.
  { id: 'memwal',             label: 'MystenLabs/MemWal docs',        repo: 'MystenLabs/MemWal',             kind: 'files', ref: 'dev',
    paths: ['SKILL.md', 'docs/llms.txt', '.claude-plugin/marketplace.json'] },
  // The deployment behind the `memwal` source above. Both are watched on purpose:
  // the docs moving means upstream's story changed, this moving means readers can
  // actually hit it. On 2026-09-04 repo and deployment were 75 commits apart, and
  // only this one says which a skill is allowed to describe as current behaviour.
  { id: 'memwal-relayer',     label: 'MemWal relayer (deployed)',     kind: 'endpoint', url: 'https://relayer.memory.walrus.xyz/health', jsonPath: 'build.commit' },
  { id: 'sui-pilot',          label: 'contract-hero/sui-pilot',       repo: 'contract-hero/sui-pilot',       kind: 'commit', branch: 'main' },
]
