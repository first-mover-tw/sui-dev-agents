#!/bin/bash
# Fast mode quality check

echo "🚀 Fast Mode Quality Check"
echo ""

# Check 1: Compilation
echo "1️⃣ Checking compilation..."
if ! sui move build 2>&1 | tee build.log; then
    echo "❌ Compilation failed"
    cat build.log
    exit 1
fi
echo "✅ Compilation successful"
echo ""

# Check 2: Basic linter
echo "2️⃣ Running linter..."
if ! sui move lint 2>&1; then
    echo "⚠️  Linter warnings (non-blocking)"
fi
echo ""

echo "✅ Fast mode checks passed!"
echo "⏱️  Time: ~5 seconds"
