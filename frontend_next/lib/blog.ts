// lib/blog.ts — Blog post loading utilities
import fs from "fs";
import path from "path";
import { parseFrontmatter } from "@/lib/frontmatter";
import readingTime from "reading-time";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export type BlogFrontmatter = {
  title: string;
  slug: string;
  description: string;
  date: string; // ISO date string
  coverImage?: string;
  tags?: string[];
  author?: string;
};

export type BlogPost = BlogFrontmatter & {
  readingTime: string;
  content: string; // raw MDX source (no frontmatter)
};

export type BlogPostMeta = Omit<BlogPost, "content">;

/** Get all .mdx files sorted by date descending. */
export function getAllPosts(): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));

  const posts: BlogPostMeta[] = files
    .map((filename) => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf-8");
      const { data, content } = parseFrontmatter(raw);
      const slug = filename.replace(/\.mdx$/, "");
      const rt = readingTime(content);

      return {
        title: String(data.title || slug),
        slug,
        description: String(data.description || ""),
        date: String(data.date || ""),
        coverImage: data.coverImage ? String(data.coverImage) : undefined,
        tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
        author: data.author ? String(data.author) : undefined,
        readingTime: rt.text,
      };
    })
    .filter((p) => p.date); // skip posts without a date

  posts.sort((a, b) => (a.date > b.date ? -1 : 1));
  return posts;
}

/** Get a single post by slug, including raw MDX content. */
export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = parseFrontmatter(raw);
  const rt = readingTime(content);

  return {
    title: String(data.title || slug),
    slug,
    description: String(data.description || ""),
    date: String(data.date || ""),
    coverImage: data.coverImage ? String(data.coverImage) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
    author: data.author ? String(data.author) : undefined,
    readingTime: rt.text,
    content,
  };
}

/** Get all slugs for generateStaticParams. */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}
