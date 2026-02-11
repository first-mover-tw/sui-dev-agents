/**
 * Minimal YAML parser — only extracts top-level scalar key: value pairs.
 * Sufficient for reading active_address from sui client.yaml.
 */
export function parse(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^(\w+):\s*"?([^"#\n]+)"?\s*$/);
    if (match) {
      result[match[1]] = match[2].trim();
    }
  }
  return result;
}
