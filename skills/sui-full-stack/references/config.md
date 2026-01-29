# Configuration & CLI Usage

## Configuration File

Create `.sui-full-stack.json` in your project root:

```json
{
  "auto_commit": true,
  "git_enabled": true,
  "github_sync": true,
  "quality_gates": true,
  "auto_verify_tests": true,
  "max_test_retries": 5,
  "default_quality_mode": "strict",
  "stages": {
    "architect": { "enabled": true },
    "develop": { "enabled": true },
    "frontend": { "enabled": true, "optional": true },
    "integration": { "enabled": true },
    "testing": { "enabled": true },
    "deployment": { "enabled": true }
  }
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `auto_commit` | boolean | true | Auto-commit at each phase checkpoint |
| `git_enabled` | boolean | true | Enable Git integration |
| `github_sync` | boolean | true | Push to GitHub after commits |
| `quality_gates` | boolean | true | Enforce quality checks between phases |
| `auto_verify_tests` | boolean | true | Auto-run tests after code changes |
| `max_test_retries` | number | 5 | Max auto-fix attempts for failing tests |
| `default_quality_mode` | string | "strict" | Default quality check mode |

## Stage Configuration

Each stage can be configured individually:

```json
{
  "stages": {
    "architect": { 
      "enabled": true 
    },
    "frontend": { 
      "enabled": true, 
      "optional": true  // User can skip this stage
    }
  }
}
```

---

## Command-Line Usage

```bash
# Start new project
sui-full-stack

# Resume existing project
sui-full-stack --resume

# Skip to specific stage
sui-full-stack --stage testing

# Disable Git integration
sui-full-stack --no-git

# Use specific quality mode
sui-full-stack --quality-mode standard
```

## CLI Options

| Flag | Description |
|------|-------------|
| `--resume` | Resume from saved project state |
| `--stage <name>` | Skip to specific stage |
| `--no-git` | Disable Git integration |
| `--quality-mode <mode>` | Set quality check mode (fast/standard/strict) |
| `--dry-run` | Preview actions without executing |
