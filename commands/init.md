---
name: init
description: Initialize new SUI Move project with proper structure
---

# Initialize SUI Move Project

When invoked, follow these steps:

1. **Ask for project details**:
   - Project name (required)
   - Brief description (optional)
   - Target directory (default: current directory)

2. **Create project structure**:
   ```bash
   sui move new <project-name>
   cd <project-name>
   ```

3. **Enhance Move.toml**:
   - Add description if provided
   - Set edition = "2024.beta"
   - Add common dependencies (Sui framework at Protocol 117)
   - Configure addresses section

4. **Create additional structure**:
   ```
   tests/          # Integration tests
   scripts/        # Deployment scripts
   docs/           # Documentation
   .gitignore      # Ignore build artifacts
   ```

5. **Generate template files**:
   - `sources/<project_name>.move` with basic module structure
   - `tests/<project_name>_tests.move` with test scaffold
   - `README.md` with project overview

6. **Initialize git** (if not in a git repo):
   ```bash
   git init
   git add .
   git commit -m "Initial SUI Move project setup"
   ```

7. **Verify setup**:
   - Run `sui move build --skip-fetch-latest-git-deps`
   - Confirm successful compilation

8. **Output summary**:
   - Project location
   - Next steps (write modules, run tests, etc.)
   - Available commands (build, test, deploy)
