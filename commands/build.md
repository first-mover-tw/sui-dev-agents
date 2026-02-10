---
name: build
description: Build Move package with comprehensive error reporting
---

# Build Move Package

When invoked, follow these steps:

1. **Pre-build checks**:
   - Verify `Move.toml` exists in current directory
   - Check for `sources/` directory
   - Validate Move.toml syntax

2. **Run build**:
   ```bash
   sui move build --skip-fetch-latest-git-deps
   ```

3. **Parse output**:
   - If successful: Show compiled modules and byte count
   - If failed: Extract and highlight specific errors

4. **Error analysis** (if build fails):
   - **Syntax errors**: Point to exact line/column
   - **Type errors**: Explain mismatch with examples
   - **Dependency issues**: Check Move.toml dependencies
   - **Capability/witness errors**: Explain pattern requirements
   - **Linter warnings**: Categorize by severity

5. **Suggest fixes for common issues**:
   - Missing imports → Add `use sui::...`
   - Unused code → Remove or add `#[allow(unused)]`
   - Ability constraints → Explain `store`, `copy`, `drop`, `key`
   - Generic constraints → Show correct syntax

6. **Output build artifacts info**:
   - Location: `build/<package>/bytecode_modules/`
   - Module digests
   - Dependencies included

7. **Next steps**:
   - Run tests with `/sui-dev-agents:test`
   - Deploy with `/sui-dev-agents:deploy`
   - Audit with `/sui-dev-agents:audit`
