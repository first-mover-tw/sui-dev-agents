# Browser Scraping Patterns for SUI Explorers

Playwright MCP snippets for extracting Move source code from block explorers.

---

## Suivision (Preferred — often has verified source)

**URL:** `https://suivision.xyz/package/{package_id}?tab=Code`

### Extract source code from code table
```javascript
() => {
  const rows = document.querySelectorAll('table tr');
  const lines = [];
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if (cells.length >= 2) lines.push(cells[1].textContent);
  });
  return lines.join('\n');
}
```

### List module names from sidebar
```javascript
() => {
  const codeSection = document.querySelector('table')?.closest('div')?.parentElement;
  if (!codeSection) return [];
  const candidates = codeSection.querySelectorAll('div, span, li, a');
  return Array.from(candidates)
    .map(el => el.textContent.trim())
    .filter(t => t && /^[a-z_][a-z0-9_]*$/.test(t) && t.length < 30);
}
```

### Workflow
1. Navigate to URL with `?tab=Code`
2. Wait for `table tr` elements to load
3. If multiple modules: use `browser_snapshot` to find sidebar names, click each
4. Extract code per module with `browser_evaluate`

---

## Suiscan (Alternative — always available via Revela decompilation)

**URL:** `https://suiscan.xyz/{network}/object/{package_id}/contracts`

Where `{network}` is `mainnet`, `testnet`, or `devnet`.

### Extract source code
```javascript
() => {
  const rows = document.querySelectorAll('table tr');
  const lines = [];
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if (cells.length >= 2) lines.push(cells[1].textContent);
  });
  return lines.join('\n') || 'Source not found - try clicking Source tab';
}
```

### Workflow
1. Navigate to URL
2. Click "Source" tab (default may show Bytecode)
3. Click module tabs if multiple modules
4. Extract code with `browser_evaluate`

---

## Multi-Module Extraction

For packages with multiple modules (e.g., DeepBook `0xdee9`):

1. List modules from sidebar/tabs
2. Click each module → extract code
3. Save to `decompiled/{module_name}.move`

```
decompiled/
├── clob_v2.move
├── custodian_v2.move
├── math.move
└── order_query.move
```

## Notes
- Close browser tabs after extraction to avoid resource leaks
- Respect rate limits — don't scrape aggressively
- Suivision verified source > Suiscan Revela decompilation in readability
- Decompiled code may not compile directly (variable names differ)
