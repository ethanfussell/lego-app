// app/api/blog/route.ts — Blog post CRUD API (admin only)
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseFrontmatter, stringifyFrontmatter } from "@/lib/frontmatter";
import { auth } from "@clerk/nextjs/server";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

// Ensure the blog directory exists
function ensureDir() {
  if (!fs.existsSync(BLOG_DIR)) {
    fs.mkdirSync(BLOG_DIR, { recursive: true });
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** GET /api/blog — List all posts */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  ensureDir();
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));

  const posts = files.map((filename) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf-8");
    const { data, content } = parseFrontmatter(raw);
    const slug = filename.replace(/\.mdx$/, "");
    return {
      slug,
      title: String(data.title || slug),
      description: String(data.description || ""),
      date: String(data.date || ""),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      coverImage: data.coverImage ? String(data.coverImage) : "",
      content,
    };
  });

  posts.sort((a, b) => (a.date > b.date ? -1 : 1));
  return NextResponse.json(posts);
}

/** POST /api/blog — Create or update a post */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  ensureDir();

  const body = await req.json();
  const { title, description, date, tags, coverImage, content, slug: existingSlug } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const slug = existingSlug || slugify(title);
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);

  // Build frontmatter
  const frontmatter: Record<string, unknown> = {
    title,
    description: description || "",
    date: date || new Date().toISOString().slice(0, 10),
  };
  if (tags?.length) frontmatter.tags = tags;
  if (coverImage) frontmatter.coverImage = coverImage;

  const fileContent = stringifyFrontmatter(content, frontmatter);
  fs.writeFileSync(filePath, fileContent, "utf-8");

  return NextResponse.json({ ok: true, slug });
}

/** DELETE /api/blog?slug=xxx — Delete a post */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  fs.unlinkSync(filePath);
  return NextResponse.json({ ok: true });
}
