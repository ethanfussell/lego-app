// app/blog/page.tsx — Blog listing page
import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, type BlogPostMeta } from "@/lib/blog";
import { SITE_NAME } from "@/lib/url";

export const metadata: Metadata = {
  title: "Blog",
  description: `Articles, guides, and news about LEGO sets, collecting, and more from ${SITE_NAME}.`,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: `Blog | ${SITE_NAME}`,
    description: `Articles, guides, and news about LEGO sets and collecting.`,
    url: "/blog",
    type: "website",
  },
};

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-xl border border-zinc-200 p-5 transition-colors hover:border-amber-300 hover:bg-amber-50/30"
    >
      {post.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImage}
          alt={post.title}
          className="mb-4 h-48 w-full rounded-lg object-cover"
        />
      ) : null}

      <h2 className="text-lg font-bold text-zinc-900 group-hover:text-amber-600 transition-colors">
        {post.title}
      </h2>

      <p className="mt-2 text-sm text-zinc-600 line-clamp-2">{post.description}</p>

      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
        <time dateTime={post.date}>
          {new Date(post.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <span>{post.readingTime}</span>
      </div>

      {post.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <section className="py-10">
      <h1 className="text-3xl font-bold text-zinc-900">Blog</h1>
      <p className="mt-2 text-zinc-500">
        Guides, rankings, and news for LEGO collectors.
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 text-center text-zinc-400">No posts yet. Check back soon!</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </section>
  );
}
