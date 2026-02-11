#!/usr/bin/env python3
"""
Sui Move LCOV Coverage Analyzer

Parses LCOV format output from `sui move coverage lcov` and identifies
uncovered functions, lines, and branches with actionable suggestions.

Usage:
    sui move coverage lcov
    python3 analyze_lcov.py lcov.info [-s sources/] [--issues-only] [--json]
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BranchInfo:
    line: int
    block: int
    branch: int
    taken: bool
    count: int


@dataclass
class FunctionInfo:
    name: str
    line: int
    call_count: int


@dataclass
class FileCoverage:
    path: str
    functions: list[FunctionInfo] = field(default_factory=list)
    line_hits: dict[int, int] = field(default_factory=dict)
    branches: list[BranchInfo] = field(default_factory=list)
    functions_found: int = 0
    functions_hit: int = 0
    lines_found: int = 0
    lines_hit: int = 0
    branches_found: int = 0
    branches_hit: int = 0


def parse_lcov(lcov_path: str) -> list[FileCoverage]:
    """Parse LCOV file and return coverage data per source file."""
    files = []
    current = None
    fn_lines = {}
    fn_counts = {}

    with open(lcov_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            if line.startswith('SF:'):
                current = FileCoverage(path=line[3:])
                fn_lines = {}
                fn_counts = {}
            elif line.startswith('FN:'):
                parts = line[3:].split(',', 1)
                if len(parts) == 2:
                    fn_lines[parts[1]] = int(parts[0])
            elif line.startswith('FNDA:'):
                parts = line[5:].split(',', 1)
                if len(parts) == 2 and current:
                    fn_counts[parts[1]] = int(parts[0])
            elif line.startswith('DA:'):
                parts = line[3:].split(',')
                if len(parts) == 2 and current:
                    current.line_hits[int(parts[0])] = int(parts[1])
            elif line.startswith('BRDA:'):
                parts = line[5:].split(',')
                if len(parts) == 4 and current:
                    count = -1 if parts[3] == '-' else int(parts[3])
                    current.branches.append(BranchInfo(
                        line=int(parts[0]), block=int(parts[1]),
                        branch=int(parts[2]), taken=count > 0, count=count
                    ))
            elif line.startswith('FNF:') and current:
                current.functions_found = int(line[4:])
            elif line.startswith('FNH:') and current:
                current.functions_hit = int(line[4:])
            elif line.startswith('LF:') and current:
                current.lines_found = int(line[3:])
            elif line.startswith('LH:') and current:
                current.lines_hit = int(line[3:])
            elif line.startswith('BRF:') and current:
                current.branches_found = int(line[4:])
            elif line.startswith('BRH:') and current:
                current.branches_hit = int(line[4:])
            elif line == 'end_of_record':
                if current:
                    for name, fn_line in fn_lines.items():
                        current.functions.append(FunctionInfo(
                            name=name, line=fn_line, call_count=fn_counts.get(name, 0)
                        ))
                    files.append(current)
                    current = None
                    fn_lines = {}
                    fn_counts = {}

    if current:
        for name, fn_line in fn_lines.items():
            current.functions.append(FunctionInfo(
                name=name, line=fn_line, call_count=fn_counts.get(name, 0)
            ))
        files.append(current)

    return files


def read_source_lines(source_path: str) -> dict[int, str]:
    """Read source file and return line number -> content mapping."""
    lines = {}
    try:
        with open(source_path, 'r') as f:
            for i, line in enumerate(f, 1):
                lines[i] = line.rstrip()
    except Exception:
        pass
    return lines


def generate_suggestions(cov: FileCoverage, source_lines: Optional[dict] = None) -> list[dict]:
    """Generate actionable suggestions for improving coverage."""
    suggestions = []

    for f in cov.functions:
        if f.call_count == 0:
            sug = {
                'type': 'uncalled_function', 'priority': 'high',
                'function': f.name, 'line': f.line,
                'action': f'Write a test that calls `{f.name}()`'
            }
            if source_lines and f.line in source_lines:
                sug['source'] = source_lines[f.line]
            suggestions.append(sug)

    branch_lines = {}
    for b in cov.branches:
        if not b.taken:
            branch_lines.setdefault(b.line, []).append(b)

    for line, branches in branch_lines.items():
        sug = {
            'type': 'untaken_branch', 'priority': 'medium',
            'line': line, 'branches': len(branches),
            'action': f'Add test to cover alternate branch at line {line}'
        }
        if source_lines and line in source_lines:
            sug['source'] = source_lines[line]
        suggestions.append(sug)

    uncovered = sorted(ln for ln, count in cov.line_hits.items() if count == 0)
    if uncovered:
        ranges = []
        start = end = uncovered[0]
        for ln in uncovered[1:]:
            if ln == end + 1:
                end = ln
            else:
                ranges.append((start, end))
                start = end = ln
        ranges.append((start, end))

        for s, e in ranges:
            desc = f'line {s}' if s == e else f'lines {s}-{e}'
            suggestions.append({
                'type': 'uncovered_lines', 'priority': 'low',
                'start_line': s, 'end_line': e,
                'action': f'Write test to execute {desc}'
            })

    return suggestions


def analyze(lcov_path: str, source_dir: Optional[str] = None) -> dict:
    """Main analysis function."""
    files = parse_lcov(lcov_path)

    summary = {
        'total_files': len(files),
        'total_functions_found': sum(f.functions_found for f in files),
        'total_functions_hit': sum(f.functions_hit for f in files),
        'total_lines_found': sum(f.lines_found for f in files),
        'total_lines_hit': sum(f.lines_hit for f in files),
        'total_branches_found': sum(f.branches_found for f in files),
        'total_branches_hit': sum(f.branches_hit for f in files),
    }

    if summary['total_lines_found']:
        summary['line_coverage_pct'] = round(100 * summary['total_lines_hit'] / summary['total_lines_found'], 1)
    if summary['total_branches_found']:
        summary['branch_coverage_pct'] = round(100 * summary['total_branches_hit'] / summary['total_branches_found'], 1)
    if summary['total_functions_found']:
        summary['function_coverage_pct'] = round(100 * summary['total_functions_hit'] / summary['total_functions_found'], 1)

    results = {'summary': summary, 'files': []}

    for cov in files:
        source_lines = None
        if source_dir:
            basename = os.path.basename(cov.path)
            for candidate in [os.path.join(source_dir, basename), cov.path]:
                if os.path.exists(candidate):
                    source_lines = read_source_lines(candidate)
                    break

        uncovered_lines = sorted(ln for ln, count in cov.line_hits.items() if count == 0)
        results['files'].append({
            'path': cov.path,
            'coverage': {
                'functions': f"{cov.functions_hit}/{cov.functions_found}",
                'lines': f"{cov.lines_hit}/{cov.lines_found}",
                'branches': f"{cov.branches_hit}/{cov.branches_found}",
            },
            'uncovered_lines': uncovered_lines,
            'untaken_branches': [{'line': b.line, 'block': b.block, 'branch': b.branch}
                                 for b in cov.branches if not b.taken],
            'uncalled_functions': [{'name': f.name, 'line': f.line}
                                   for f in cov.functions if f.call_count == 0],
            'suggestions': generate_suggestions(cov, source_lines),
        })

    return results


def print_human_readable(results: dict):
    """Print results in a human-readable format."""
    s = results['summary']
    print("=" * 60)
    print("SUI MOVE COVERAGE ANALYSIS")
    print("=" * 60)
    print(f"\nFiles analyzed: {s['total_files']}")
    print(f"Function coverage: {s['total_functions_hit']}/{s['total_functions_found']} ({s.get('function_coverage_pct', 'N/A')}%)")
    print(f"Line coverage: {s['total_lines_hit']}/{s['total_lines_found']} ({s.get('line_coverage_pct', 'N/A')}%)")
    print(f"Branch coverage: {s['total_branches_hit']}/{s['total_branches_found']} ({s.get('branch_coverage_pct', 'N/A')}%)")

    for fd in results['files']:
        print(f"\n{'─' * 60}")
        print(f"  {fd['path']}")
        print(f"   Lines: {fd['coverage']['lines']}, "
              f"Branches: {fd['coverage']['branches']}, "
              f"Functions: {fd['coverage']['functions']}")

        if fd['uncalled_functions']:
            print("\n   Uncalled functions:")
            for f in fd['uncalled_functions']:
                print(f"      - {f['name']} (line {f['line']})")

        if fd['untaken_branches']:
            lines = set(b['line'] for b in fd['untaken_branches'])
            print("\n   Untaken branches:")
            for ln in sorted(lines):
                count = sum(1 for b in fd['untaken_branches'] if b['line'] == ln)
                print(f"      - Line {ln}: {count} branch(es) not taken")

        if fd['suggestions']:
            print("\n   Suggestions:")
            priority_marker = {'high': '[HIGH]', 'medium': '[MED]', 'low': '[LOW]'}
            for i, sug in enumerate(fd['suggestions'], 1):
                print(f"      {i}. {priority_marker.get(sug['priority'], '')} {sug['action']}")

    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description='Analyze Sui Move LCOV coverage')
    parser.add_argument('lcov_file', help='Path to lcov.info file')
    parser.add_argument('--source-dir', '-s', help='Directory containing Move source files')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')
    parser.add_argument('--filter', '-f', help='Only show files matching this path pattern')
    parser.add_argument('--issues-only', '-i', action='store_true', help='Only show files with coverage issues')
    args = parser.parse_args()

    if not os.path.exists(args.lcov_file):
        print(f"Error: File not found: {args.lcov_file}", file=sys.stderr)
        sys.exit(1)

    results = analyze(args.lcov_file, args.source_dir)

    if args.filter or args.issues_only:
        filtered = []
        for fd in results['files']:
            if args.filter and args.filter not in fd['path']:
                continue
            if args.issues_only and not (fd['uncovered_lines'] or fd['untaken_branches'] or fd['uncalled_functions']):
                continue
            filtered.append(fd)
        results['files'] = filtered
        results['summary']['total_files'] = len(filtered)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_human_readable(results)


if __name__ == '__main__':
    main()
