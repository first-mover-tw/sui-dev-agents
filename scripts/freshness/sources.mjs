// scripts/freshness/sources.mjs
// Each source: id, label, kind, and the args needed to fetch its marker.
// kind 'release' -> latest release tag; 'commit' -> default-branch HEAD sha; 'page' -> Last-Modified/hash.
export const SOURCES = [
  { id: 'docs-release-notes', label: 'docs.sui.io/release-notes', kind: 'page', url: 'https://docs.sui.io/references/release-notes' },
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
  { id: 'memwal',             label: 'MystenLabs/MemWal',             repo: 'MystenLabs/MemWal',             kind: 'commit', branch: 'dev' },
  { id: 'sui-pilot',          label: 'contract-hero/sui-pilot',       repo: 'contract-hero/sui-pilot',       kind: 'commit', branch: 'main' },
]
