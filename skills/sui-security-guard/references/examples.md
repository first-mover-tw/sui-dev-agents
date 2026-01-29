# SUI Security Guard - Examples

Scan output examples and remediation guides.

## Example 1: Secret Detected

```
❌ ERROR: Private key detected!
File: src/config.ts:12
Pattern: suiprivkey1abc...

Action Required:
1. Remove the private key from the file
2. Use environment variables instead:
   const PRIVATE_KEY = process.env.PRIVATE_KEY;
3. Add to .gitignore: .env
4. Rotate the compromised key
```

## Example 2: Clean Scan

```
✅ Security scan passed!
Files scanned: 147
Issues found: 0
```
