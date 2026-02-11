#!/usr/bin/env python3
"""
Parse Sui Move source coverage output (ANSI colors) to identify uncovered code.

Usage:
    sui move coverage source --module <name> 2>&1 | python3 parse_source.py
    script -q /dev/null sui move coverage source --module <name> | python3 parse_source.py
"""

import re
import sys
import json

ANSI_PATTERN = re.compile(r'\x1b\[(\d+)m')
GREEN_CODE = '32'
RED_CODE = '31'


def parse_ansi_line(line: str) -> list[dict]:
    """Parse a line with ANSI codes into segments."""
    segments = []
    current_color = None
    parts = ANSI_PATTERN.split(line)
    current_text = ""

    for part in parts:
        if part == GREEN_CODE:
            if current_text:
                segments.append({'text': current_text, 'covered': current_color})
                current_text = ""
            current_color = True
        elif part == RED_CODE:
            if current_text:
                segments.append({'text': current_text, 'covered': current_color})
                current_text = ""
            current_color = False
        elif part in ('39', '0'):
            if current_text:
                segments.append({'text': current_text, 'covered': current_color})
                current_text = ""
            current_color = None
        else:
            current_text += part

    if current_text:
        segments.append({'text': current_text, 'covered': current_color})

    return segments


def analyze_coverage(input_text: str) -> dict:
    """Analyze source coverage and return structured data."""
    results = {
        'uncovered_summary': [],
        'stats': {'total_lines': 0, 'lines_with_uncovered': 0, 'fully_covered_lines': 0}
    }

    for line_num, line in enumerate(input_text.split('\n'), 1):
        if not line.strip():
            continue

        segments = parse_ansi_line(line)
        uncovered_texts = [s['text'] for s in segments if s['covered'] is False and s['text'].strip()]
        has_covered = any(s['covered'] is True for s in segments)

        if has_covered or uncovered_texts:
            results['stats']['total_lines'] += 1
            if uncovered_texts:
                results['stats']['lines_with_uncovered'] += 1
                clean_line = ANSI_PATTERN.sub('', line).replace('\x1b[', '')
                results['uncovered_summary'].append({
                    'line': line_num,
                    'code': clean_line.strip(),
                    'uncovered_parts': uncovered_texts,
                })
            else:
                results['stats']['fully_covered_lines'] += 1

    return results


def print_report(results: dict):
    """Print human-readable coverage report."""
    stats = results['stats']
    total = stats['total_lines']
    covered = stats['fully_covered_lines']
    uncovered = stats['lines_with_uncovered']

    print("=" * 70)
    print("SOURCE COVERAGE ANALYSIS")
    print("=" * 70)

    if total > 0:
        print(f"\nLines with executable code: {total}")
        print(f"Fully covered lines:        {covered} ({100*covered//total}%)")
        print(f"Lines with uncovered code:  {uncovered} ({100*uncovered//total}%)")

    if results['uncovered_summary']:
        print("\n" + "-" * 70)
        print("UNCOVERED CODE")
        print("-" * 70)
        for item in results['uncovered_summary']:
            print(f"\n  Line {item['line']}:")
            print(f"   {item['code']}")
            print(f"   Uncovered: {item['uncovered_parts']}")

    print("\n" + "=" * 70)


def main():
    if sys.stdin.isatty():
        print("Usage: sui move coverage source --module <name> 2>&1 | python3 parse_source.py")
        print("\nTo preserve colors when piping:")
        print("  script -q /dev/null sui move coverage source --module <name> | python3 parse_source.py")
        sys.exit(1)

    input_text = sys.stdin.read()

    if '\x1b[' not in input_text:
        print("Warning: No ANSI color codes detected. Colors may be lost during piping.", file=sys.stderr)
        print("Try: script -q /dev/null sui move coverage source --module <name> | python3 parse_source.py", file=sys.stderr)

    results = analyze_coverage(input_text)

    if '--json' in sys.argv:
        print(json.dumps(results, indent=2))
    else:
        print_report(results)


if __name__ == '__main__':
    main()
