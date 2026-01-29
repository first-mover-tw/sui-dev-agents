# SUI Tester - Examples

Complete test examples for all test types.

## Example 1: Unit Test

```move
#[test]
fun test_create_listing() {
    let seller = @0xA;
    let mut scenario = test_scenario::begin(seller);
    
    let nft = create_test_nft(&mut scenario);
    let listing = create_listing(nft, 1000, ctx);
    
    assert!(price(&listing) == 1000, 0);
    assert!(seller(&listing) == seller, 1);
    
    test_scenario::end(scenario);
}
```

## Example 2: Integration Test

```move
#[test]
fun test_marketplace_with_royalty() {
    // Test listing creation with royalty deduction
    // Verify all payments distributed correctly
}
```

## Example 3: E2E Test

```typescript
test('complete buy flow', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.click('button:has-text("Buy Now")');
    await expect(page.locator('text=Purchase successful')).toBeVisible();
});
```

See reference.md for complete patterns.
