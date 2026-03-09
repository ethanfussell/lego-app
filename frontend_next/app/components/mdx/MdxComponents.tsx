// Custom MDX components available in all blog posts
import Link from "next/link";
import type { MDXComponents } from "mdx/types";

/* ─── SetLink: inline link to a set page ─── */
function SetLink({ setNum, children }: { setNum: string; children?: React.ReactNode }) {
  return (
    <Link
      href={`/sets/${encodeURIComponent(setNum)}`}
      className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:text-amber-500 underline underline-offset-2"
    >
      {children || setNum}
    </Link>
  );
}

/* ─── ThemeLink: inline link to a theme page ─── */
function ThemeLink({ slug, children }: { slug: string; children?: React.ReactNode }) {
  return (
    <Link
      href={`/themes/${encodeURIComponent(slug)}`}
      className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:text-amber-500 underline underline-offset-2"
    >
      {children || slug}
    </Link>
  );
}

/* ─── Callout: highlighted info/tip/warning box ─── */
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

/* ─── CTA: call-to-action button ─── */
function CTA({ href, children }: { href: string; children: React.ReactNode }) {
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

/* ─── Base MDX component overrides ─── */
export const mdxComponents: MDXComponents = {
  // Custom components available via <SetLink>, <ThemeLink>, etc.
  SetLink,
  ThemeLink,
  Callout,
  CTA,

  // Override default HTML elements for consistent styling
  h1: (props) => <h1 className="mt-10 mb-4 text-3xl font-bold text-zinc-900" {...props} />,
  h2: (props) => <h2 className="mt-8 mb-3 text-2xl font-bold text-zinc-900" {...props} />,
  h3: (props) => <h3 className="mt-6 mb-2 text-xl font-semibold text-zinc-900" {...props} />,
  p: (props) => <p className="my-4 leading-7 text-zinc-700" {...props} />,
  ul: (props) => <ul className="my-4 ml-6 list-disc space-y-2 text-zinc-700" {...props} />,
  ol: (props) => <ol className="my-4 ml-6 list-decimal space-y-2 text-zinc-700" {...props} />,
  li: (props) => <li className="leading-7" {...props} />,
  a: (props) => (
    <a
      className="text-amber-600 hover:text-amber-500 underline underline-offset-2"
      target={props.href?.startsWith("http") ? "_blank" : undefined}
      rel={props.href?.startsWith("http") ? "noopener noreferrer" : undefined}
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="my-6 border-l-4 border-zinc-300 pl-4 italic text-zinc-600"
      {...props}
    />
  ),
  code: (props) => (
    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-mono text-zinc-800" {...props} />
  ),
  pre: (props) => (
    <pre className="my-6 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100" {...props} />
  ),
  img: (props) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="my-6 rounded-lg" alt={props.alt || ""} {...props} />
  ),
  hr: () => <hr className="my-8 border-zinc-200" />,
  table: (props) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full text-sm text-zinc-700" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b border-zinc-200 px-3 py-2 text-left font-semibold" {...props} />,
  td: (props) => <td className="border-b border-zinc-100 px-3 py-2" {...props} />,
};
