#!/bin/bash
echo "🧪 Running test suite..."

echo "1️⃣ Unit tests..."
sui move test

echo "2️⃣ Coverage..."
sui move test --coverage
sui move coverage summary

echo "✅ Tests complete"
