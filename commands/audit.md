---
name: audit
description: Security audit checklist and vulnerability scanning
---

# Security Audit

When invoked, follow these steps:

1. **Scan all Move files**:
   - Find all `.move` files in `sources/`
   - Read and parse module structures
   - Identify public entry functions

2. **Check for common vulnerabilities**:

   **Access Control**:
   - Public entry functions without capability checks
   - Missing owner/admin verification
   - Unprotected admin functions

   **Object Transfer**:
   - `transfer::public_transfer` without validation
   - Missing recipient checks
   - Shared object concurrent access issues

   **Capability Management**:
   - Capabilities with `store` ability (leakable)
   - Missing capability destruction
   - Improper capability delegation

   **Economic Exploits**:
   - Integer overflow/underflow risks
   - Unchecked arithmetic operations
   - Price manipulation vectors
   - Flash loan vulnerabilities

   **Resource Handling**:
   - Objects not consumed or transferred
   - Missing `drop` implementation cleanup
   - Dangling references

   **Type Safety**:
   - Incorrect generic constraints
   - Missing phantom type parameters
   - Unsafe type conversions

3. **Generate audit report**:
   ```
   Security Audit Report
   =====================

   CRITICAL (must fix):
   - [sources/marketplace.move:45] Public entry function lacks capability check
   - [sources/token.move:78] Integer overflow in mint function

   HIGH (should fix):
   - [sources/vault.move:23] Capability has 'store' ability (leakable)

   MEDIUM (review):
   - [sources/nft.move:56] Missing input validation

   LOW (informational):
   - [sources/utils.move:12] Unused function

   PASSED:
   ✓ No public_transfer without validation
   ✓ Proper generic constraints
   ✓ No dangling references
   ```

4. **Best practices check**:
   - Use of one-time witnesses for type uniqueness
   - Publisher object for package verification
   - Proper event emission
   - Gas-efficient patterns

5. **Recommendations**:
   - Prioritize fixes by severity
   - Suggest specific code changes
   - Reference SUI security guidelines
   - Recommend external audit if needed

6. **Save report**:
   - Create `audits/audit-<timestamp>.md`
   - Include full details and code snippets
   - Track resolution status
