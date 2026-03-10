// lib/frontmatter.ts — Zero-dependency frontmatter parser for Turbopack compatibility

const FENCE = "---";

/**
 * Minimal YAML parser — handles the subset used by blog frontmatter:
 * scalar values (strings, numbers, booleans) and simple arrays.
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let currentKey = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Array item (e.g. "  - value")
    if (/^\s+-\s+/.test(line)) {
      const value = line.replace(/^\s+-\s+/, "").trim();
      if (currentKey && Array.isArray(result[currentKey])) {
        (result[currentKey] as string[]).push(unquote(value));
      }
      continue;
    }

    // Key-value pair
    const match = line.match(/^(\w[\w.-]*)\s*:\s*(.*)/);
    if (match) {
      const [, key, rawValue] = match;
      const trimmed = rawValue.trim();

      if (trimmed === "" || trimmed === "[]") {
        // Could be an empty value or start of an array block
        currentKey = key;
        // Peek ahead to see if next line is an array item
        if (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
          result[key] = [];
        } else {
          result[key] = trimmed === "[]" ? [] : "";
        }
      } else if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        // Inline array: [a, b, c]
        const inner = trimmed.slice(1, -1);
        result[key] = inner
          ? inner.split(",").map((s) => unquote(s.trim()))
          : [];
        currentKey = key;
      } else {
        result[key] = parseScalar(trimmed);
        currentKey = key;
      }
    }
  }

  return result;
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseScalar(s: string): string | number | boolean {
  const unquoted = unquote(s);
  if (unquoted !== s) return unquoted; // was quoted — keep as string
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

/**
 * Serialize a simple record to YAML. Handles strings, numbers, booleans,
 * and arrays of strings.
 */
function stringifySimpleYaml(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${quoteIfNeeded(String(item))}`);
        }
      }
    } else {
      lines.push(`${key}: ${quoteIfNeeded(String(value ?? ""))}`);
    }
  }
  return lines.join("\n");
}

function quoteIfNeeded(s: string): string {
  if (s === "") return '""';
  // Quote if contains characters that could be ambiguous in YAML
  if (/[:#{}[\],&*?|>!%@`]/.test(s) || s.includes("\n")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

/** Parse YAML frontmatter from a markdown/MDX string. */
export function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith(FENCE)) {
    return { data: {}, content: raw };
  }

  const end = trimmed.indexOf(`\n${FENCE}`, FENCE.length);
  if (end === -1) {
    return { data: {}, content: raw };
  }

  const yamlStr = trimmed.slice(FENCE.length + 1, end);
  const content = trimmed.slice(end + FENCE.length + 2);

  const data = parseSimpleYaml(yamlStr);
  return { data, content };
}

/** Serialize data + content back to a frontmatter string. */
export function stringifyFrontmatter(
  content: string,
  data: Record<string, unknown>,
): string {
  const yaml = stringifySimpleYaml(data);
  return `---\n${yaml}\n---\n${content}`;
}
