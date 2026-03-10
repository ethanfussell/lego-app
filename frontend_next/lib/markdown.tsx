// lib/markdown.tsx — Lightweight MDX-like renderer for Turbopack compatibility
// Renders standard markdown + custom JSX-style components (<Callout>, <CTA>, etc.)

import Link from "next/link";
import React from "react";

/* ─── Custom component registry ─── */

function SetLink({ setNum, children }: { setNum: string; children?: string }) {
  return (
    <Link
      href={`/sets/${encodeURIComponent(setNum)}`}
      className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:text-amber-500 underline underline-offset-2"
    >
      {children || setNum}
    </Link>
  );
}

function ThemeLink({ slug, children }: { slug: string; children?: string }) {
  return (
    <Link
      href={`/themes/${encodeURIComponent(slug)}`}
      className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:text-amber-500 underline underline-offset-2"
    >
      {children || slug}
    </Link>
  );
}

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "tip" | "warning";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-blue-300 bg-blue-50 text-blue-900",
    tip: "border-amber-300 bg-amber-50 text-amber-900",
    warning: "border-red-300 bg-red-50 text-red-900",
  };
  return (
    <div className={`my-6 rounded-lg border-l-4 p-4 text-sm ${styles[type]}`}>
      {children}
    </div>
  );
}

function CTA({ href, children }: { href: string; children: string }) {
  return (
    <div className="my-6 text-center">
      <Link
        href={href}
        className="inline-block rounded-full bg-amber-500 px-6 py-3 font-semibold text-black hover:bg-amber-400 transition-colors"
      >
        {children}
      </Link>
    </div>
  );
}

/* ─── Markdown + custom component renderer ─── */

/**
 * Render MDX-like content: standard markdown + custom JSX components.
 * Processes the content in two passes:
 * 1. Split on custom component tags
 * 2. Render markdown blocks to HTML
 */
export function MdxContent({ source }: { source: string }) {
  const elements = parseContent(source);
  return <div className="prose-custom max-w-none">{elements}</div>;
}

// Parse inline markdown formatting (bold, italic, code, links)
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Pattern: [text](url), **bold**, *italic*, `code`, <ThemeLink ...>...</ThemeLink>
  const regex =
    /\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|<ThemeLink\s+slug="([^"]+)">(.*?)<\/ThemeLink>|<SetLink\s+setNum="([^"]+)">(.*?)<\/SetLink>/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      // Link
      const isExternal = match[2].startsWith("http");
      nodes.push(
        <a
          key={match.index}
          href={match[2]}
          className="text-amber-600 hover:text-amber-500 underline underline-offset-2"
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {match[1]}
        </a>,
      );
    } else if (match[3] !== undefined) {
      // Bold
      nodes.push(<strong key={match.index}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      // Italic
      nodes.push(<em key={match.index}>{match[4]}</em>);
    } else if (match[5] !== undefined) {
      // Inline code
      nodes.push(
        <code
          key={match.index}
          className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-mono text-zinc-800"
        >
          {match[5]}
        </code>,
      );
    } else if (match[6] !== undefined) {
      // ThemeLink
      nodes.push(<ThemeLink key={match.index} slug={match[6]}>{match[7]}</ThemeLink>);
    } else if (match[8] !== undefined) {
      // SetLink
      nodes.push(<SetLink key={match.index} setNum={match[8]}>{match[9]}</SetLink>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function parseContent(source: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = source.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Custom block components: <Callout ...> ... </Callout>
    const calloutMatch = line.match(/^<Callout(?:\s+type="(info|tip|warning)")?\s*>/);
    if (calloutMatch) {
      const type = (calloutMatch[1] || "info") as "info" | "tip" | "warning";
      const innerLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].includes("</Callout>")) {
        innerLines.push(lines[i]);
        i++;
      }
      i++; // skip closing tag
      elements.push(
        <Callout key={key++} type={type}>
          {parseContent(innerLines.join("\n"))}
        </Callout>,
      );
      continue;
    }

    // CTA component: <CTA href="...">text</CTA>
    const ctaMatch = line.match(/^<CTA\s+href="([^"]+)">(.*?)<\/CTA>/);
    if (ctaMatch) {
      elements.push(<CTA key={key++} href={ctaMatch[1]}>{ctaMatch[2]}</CTA>);
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const styles: Record<number, string> = {
        1: "mt-10 mb-4 text-3xl font-bold text-zinc-900",
        2: "mt-8 mb-3 text-2xl font-bold text-zinc-900",
        3: "mt-6 mb-2 text-xl font-semibold text-zinc-900",
        4: "mt-4 mb-2 text-lg font-semibold text-zinc-900",
        5: "mt-3 mb-1 text-base font-semibold text-zinc-900",
        6: "mt-3 mb-1 text-sm font-semibold text-zinc-900",
      };
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      elements.push(
        <Tag key={key++} className={styles[level]}>
          {renderInline(text)}
        </Tag>,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      elements.push(<hr key={key++} className="my-8 border-zinc-200" />);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={key++}
          className="my-6 border-l-4 border-zinc-300 pl-4 italic text-zinc-600"
        >
          {parseContent(quoteLines.join("\n"))}
        </blockquote>,
      );
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre
          key={key++}
          className="my-6 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={key++} className="my-4 ml-6 list-disc space-y-2 text-zinc-700">
          {items.map((item, j) => (
            <li key={j} className="leading-7">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="my-4 ml-6 list-decimal space-y-2 text-zinc-700">
          {items.map((item, j) => (
            <li key={j} className="leading-7">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      elements.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img key={key++} className="my-6 rounded-lg" alt={imgMatch[1]} src={imgMatch[2]} />,
      );
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("<") &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} className="my-4 leading-7 text-zinc-700">
          {renderInline(paraLines.join(" "))}
        </p>,
      );
    }
  }

  return elements;
}
