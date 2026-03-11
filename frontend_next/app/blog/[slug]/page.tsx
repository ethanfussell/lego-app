// app/blog/[slug]/page.tsx — Individual blog article page
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllSlugs, getPostBySlug } from "@/lib/blog";
import { siteBase, SITE_NAME } from "@/lib/url";
import { MdxContent } from "@/lib/markdown";

export const revalidate = 3600; // ISR: revalidate every hour

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Not Found" };

  const title = post.title;
  const description = post.description;
  const url = `${siteBase()}/blog/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: post.date,
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    ...(post.coverImage ? { image: post.coverImage } : {}),
    author: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteBase()}/blog/${slug}`,
    },
  };

  return (
    <article className="py-10">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-400">
        <Link href="/blog" className="hover:text-amber-600 transition-colors">
          Blog
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-600">{post.title}</span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          {post.title}
        </h1>
        <div className="mt-3 flex items-center gap-3 text-sm text-zinc-400">
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span>&middot;</span>
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
      </header>

      {/* Cover image */}
      {post.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImage}
          alt={post.title}
          className="mb-8 w-full rounded-xl object-cover"
        />
      ) : null}

      {/* MDX content */}
      <MdxContent source={post.content} />

      {/* Back link */}
      <div className="mt-12 border-t border-zinc-200 pt-6">
        <Link
          href="/blog"
          className="text-sm font-medium text-amber-600 hover:text-amber-500 transition-colors"
        >
          &larr; All articles
        </Link>
      </div>
    </article>
  );
}
