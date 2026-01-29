# SUI Security Guard - Reference

Complete scan patterns and error codes.

## Scan Patterns

### Private Keys
- Pattern: `suiprivkey1[a-zA-Z0-9]{44}`
- Severity: CRITICAL
- Action: Remove immediately

### Mnemonics
- Pattern: 12 or 24 word phrases
- Severity: CRITICAL
- Action: Regenerate wallet

### API Keys
- OpenAI: `sk-[a-zA-Z0-9]{48}`
- Anthropic: `sk-ant-[a-zA-Z0-9-]{95}`
- Severity: HIGH
- Action: Rotate keys

See examples.md for remediation steps.
