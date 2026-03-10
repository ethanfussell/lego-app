// lib/frontmatter.ts — Lightweight frontmatter parser (replaces gray-matter for Turbopack compat)
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const FENCE = "---";

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
  const content = trimmed.slice(end + FENCE.length + 2); // skip past closing fence + newline

  const data = (parseYaml(yamlStr) as Record<string, unknown>) ?? {};
  return { data, content };
}

/** Serialize data + content back to a frontmatter string. */
export function stringifyFrontmatter(
  content: string,
  data: Record<string, unknown>,
): string {
  const yaml = stringifyYaml(data).trimEnd();
  return `---\n${yaml}\n---\n${content}`;
}
