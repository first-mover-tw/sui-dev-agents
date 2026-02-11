#!/usr/bin/env python3
"""
Parse Sui Move bytecode coverage output (ANSI colors) to identify uncovered instructions.

Usage:
    sui move coverage bytecode --module <name> 2>&1 | python3 parse_bytecode.py
    sui move coverage bytecode --module <name> 2>&1 | python3 parse_bytecode.py --json
"""

import re
import sys
import json
from dataclasses import dataclass
from typing import Optional


def parse_bytecode_coverage(input_text: str) -> dict:
    """Parse bytecode coverage output and return structured data."""
    results = {
        'functions': [],
        'summary': {'total_instructions': 0, 'covered_instructions': 0, 'uncovered_instructions': 0},
        'uncovered_details': []
    }

    current_function = None
    current_instructions = []
    lines = input_text.split('\n')

    for line in lines:
        func_match = re.match(r'^(?:public\s+)?(\w+)\s*\([^)]*\)(?:\s*:\s*\w+)?\s*\{', line.strip())
        if func_match:
            if current_function and current_instructions:
                results['functions'].append({
                    'name': current_function,
                    'instructions': current_instructions,
                    'covered': sum(1 for i in current_instructions if i['covered']),
                    'total': len(current_instructions),
                })
            current_function = func_match.group(1)
            current_instructions = []
            continue

        is_covered = None
        if '\033[32m' in line or '[32m' in line:
            is_covered = True
        elif '\033[31m' in line or '[31m' in line:
            is_covered = False

        if is_covered is not None:
            source_line = None
            line_match = re.search(r'\[(\d+)\]\s*\t', line)
            if line_match:
                source_line = int(line_match.group(1))

            instr_match = re.search(r'(\d+):\s+(.+?)(?:\033\[|$)', line)
            if instr_match:
                instr_data = {
                    'source_line': source_line,
                    'offset': int(instr_match.group(1)),
                    'instruction': instr_match.group(2).strip(),
                    'covered': is_covered,
                }
                current_instructions.append(instr_data)
                results['summary']['total_instructions'] += 1
                if is_covered:
                    results['summary']['covered_instructions'] += 1
                else:
                    results['summary']['uncovered_instructions'] += 1
                    results['uncovered_details'].append({'function': current_function, **instr_data})

    if current_function and current_instructions:
        results['functions'].append({
            'name': current_function,
            'instructions': current_instructions,
            'covered': sum(1 for i in current_instructions if i['covered']),
            'total': len(current_instructions),
        })

    return results


def print_report(results: dict):
    """Print human-readable coverage report."""
    s = results['summary']
    total = s['total_instructions']
    covered = s['covered_instructions']
    uncovered = s['uncovered_instructions']

    print("=" * 60)
    print("BYTECODE COVERAGE ANALYSIS")
    print("=" * 60)
    print(f"\nTotal instructions: {total}")
    print(f"Covered:   {covered} ({100*covered//total if total else 0}%)")
    print(f"Uncovered: {uncovered} ({100*uncovered//total if total else 0}%)")

    print("\n" + "-" * 60)
    print("FUNCTION BREAKDOWN")
    print("-" * 60)

    for func in results['functions']:
        pct = 100 * func['covered'] // func['total'] if func['total'] else 0
        status = "OK" if pct == 100 else "PARTIAL" if pct > 0 else "NONE"
        print(f"  [{status}] {func['name']}: {func['covered']}/{func['total']} ({pct}%)")

    if results['uncovered_details']:
        print("\n" + "-" * 60)
        print("UNCOVERED INSTRUCTIONS")
        print("-" * 60)

        by_func = {}
        for item in results['uncovered_details']:
            fn = item['function'] or 'unknown'
            by_func.setdefault(fn, []).append(item)

        for fn, items in by_func.items():
            print(f"\n  {fn}():")
            by_line = {}
            for item in items:
                key = item['source_line'] or 'N/A'
                by_line.setdefault(key, []).append(item)

            for line, instrs in sorted(by_line.items(), key=lambda x: (x[0] is None, x[0])):
                line_str = f"Line {line}" if line != 'N/A' else "No source line"
                print(f"      {line_str}:")
                for instr in instrs:
                    print(f"         [{instr['offset']}] {instr['instruction']}")

    print("\n" + "=" * 60)


def main():
    if sys.stdin.isatty():
        print("Usage: sui move coverage bytecode --module <name> | python3 parse_bytecode.py")
        sys.exit(1)

    input_text = sys.stdin.read()
    results = parse_bytecode_coverage(input_text)

    if '--json' in sys.argv:
        print(json.dumps(results, indent=2))
    else:
        print_report(results)


if __name__ == '__main__':
    main()
