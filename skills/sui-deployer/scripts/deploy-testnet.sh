#!/bin/bash
echo "🧪 Deploying to testnet..."
sui client publish --gas-budget 100000000 --verify-dependencies
