"use client";

import React from "react";

/* ─── Inline markdown: bold, italic, code, links, SetLink, ThemeLink ─── */

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex =
    /\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|<ThemeLink\s+slug="([^"]+)">(.*?)<\/ThemeLink>|<SetLink\s+setNum="([^"]+)">(.*?)<\/SetLink>/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    if (match[1] !== undefined) {
      // Link
      nodes.push(
        <a key={match.index} href={match[2]} className="text-amber-600 hover:text-amber-500 underline underline-offset-2">
          {match[1]}
        </a>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={match.index}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(<em key={match.index}>{match[4]}</em>);
    } else if (match[5] !== undefined) {
      nodes.push(
        <code key={match.index} className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-mono text-zinc-800">
          {match[5]}
        </code>,
      );
    } else if (match[6] !== undefined) {
      nodes.push(
        <span key={match.index} className="inline-flex items-center gap-1 font-semibold text-amber-600 underline underline-offset-2">
          {match[7] || match[6]}
        </span>,
      );
    } else if (match[8] !== undefined) {
      nodes.push(
        <span key={match.index} className="inline-flex items-center gap-1 font-semibold text-amber-600 underline underline-offset-2">
          {match[9] || match[8]}
        </span>,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/* ─── Block-level parser ─── */

function parseBlocks(source: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = source.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (line.trim() === "") { i++; continue; }

    // ::set / ::sets directive — placeholder card
    const setDirective = line.trim().match(/^::sets?\s+(.+)/);
    if (setDirective) {
      const nums = setDirective[1].split(",").map((s) => s.trim()).filter(Boolean);
      elements.push(
        <div key={key++} className={`my-6 grid gap-4 ${nums.length === 1 ? "max-w-sm mx-auto" : nums.length === 2 ? "grid-cols-2 max-w-2xl mx-auto" : "grid-cols-3"}`}>
          {nums.map((num) => (
            <div key={num} className="flex items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-400">
              Set {num}
            </div>
          ))}
        </div>,
      );
      i++; continue;
    }

    // Callout block
    const calloutMatch = line.match(/^<Callout(?:\s+type="(info|tip|warning)")?\s*>/);
    if (calloutMatch) {
      const type = calloutMatch[1] || "info";
      const styles: Record<string, string> = {
        info: "border-blue-300 bg-blue-50 text-blue-900",
        tip: "border-amber-300 bg-amber-50 text-amber-900",
        warning: "border-red-300 bg-red-50 text-red-900",
      };
      const innerLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].includes("</Callout>")) { innerLines.push(lines[i]); i++; }
      i++; // skip closing tag
      elements.push(
        <div key={key++} className={`my-6 rounded-lg border-l-4 p-4 text-sm ${styles[type]}`}>
          {parseBlocks(innerLines.join("\n"))}
        </div>,
      );
      continue;
    }

    // CTA
    const ctaMatch = line.match(/^<CTA\s+href="([^"]+)">(.*?)<\/CTA>/);
    if (ctaMatch) {
      elements.push(
        <div key={key++} className="my-6 text-center">
          <span className="inline-block rounded-full bg-amber-500 px-6 py-3 font-semibold text-black">
            {ctaMatch[2]}
          </span>
        </div>,
      );
      i++; continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const styles: Record<number, string> = {
        1: "mt-10 mb-4 text-3xl font-bold text-zinc-900",
        2: "mt-8 mb-3 text-2xl font-bold text-zinc-900",
        3: "mt-6 mb-2 text-xl font-semibold text-zinc-900",
        4: "mt-4 mb-2 text-lg font-semibold text-zinc-900",
        5: "mt-3 mb-1 text-base font-semibold text-zinc-900",
        6: "mt-3 mb-1 text-sm font-semibold text-zinc-900",
      };
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      elements.push(<Tag key={key++} className={styles[level]}>{renderInline(headingMatch[2])}</Tag>);
      i++; continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      elements.push(<hr key={key++} className="my-8 border-zinc-200" />);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) { quoteLines.push(lines[i].slice(2)); i++; }
      elements.push(
        <blockquote key={key++} className="my-6 border-l-4 border-zinc-300 pl-4 italic text-zinc-600">
          {parseBlocks(quoteLines.join("\n"))}
        </blockquote>,
      );
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++;
      elements.push(
        <pre key={key++} className="my-6 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*+]\s+/, "")); i++; }
      elements.push(
        <ul key={key++} className="my-4 ml-6 list-disc space-y-2 text-zinc-700">
          {items.map((item, j) => <li key={j} className="leading-7">{renderInline(item)}</li>)}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      elements.push(
        <ol key={key++} className="my-4 ml-6 list-decimal space-y-2 text-zinc-700">
          {items.map((item, j) => <li key={j} className="leading-7">{renderInline(item)}</li>)}
        </ol>,
      );
      continue;
    }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      // eslint-disable-next-line @next/next/no-img-element
      elements.push(<img key={key++} className="my-6 rounded-lg" alt={imgMatch[1]} src={imgMatch[2]} />);
      i++; continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("<") &&
      !/^::sets?\s+/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) { paraLines.push(lines[i]); i++; }
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

/* ─── Full article preview ─── */

export default function BlogPreview({
  title,
  description,
  date,
  tags,
  coverImage,
  content,
}: {
  title: string;
  description: string;
  date: string;
  tags: string[];
  coverImage: string;
  content: string;
}) {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const readingTime = `${Math.max(1, Math.round(wordCount / 200))} min read`;

  return (
    <article className="py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-400">
        <span className="hover:text-amber-600 transition-colors">Blog</span>
        <span className="mx-2">/</span>
        <span className="text-zinc-600">{title || "Untitled"}</span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          {title || "Untitled Post"}
        </h1>
        {description && (
          <p className="mt-2 text-lg text-zinc-500">{description}</p>
        )}
        <div className="mt-3 flex items-center gap-3 text-sm text-zinc-400">
          <time dateTime={date}>
            {date
              ? new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "No date"}
          </time>
          <span>&middot;</span>
          <span>{readingTime}</span>
        </div>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Cover image */}
      {coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImage} alt={title} className="mb-8 w-full rounded-xl object-cover" />
      )}

      {/* Content */}
      <div className="prose-custom max-w-none">
        {content ? parseBlocks(content) : (
          <p className="text-zinc-400 italic">Start writing to see the preview...</p>
        )}
      </div>
    </article>
  );
}
