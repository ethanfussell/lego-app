"use client";

import React, { useCallback, useEffect, useState } from "react";
import BlogPreview from "./BlogPreview";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  coverImage: string;
  content: string;
};

type EditorMode = "list" | "edit";
type EditorTab = "write" | "preview";

// ---------------------------------------------------------------------------
// Toolbar button helper
// ---------------------------------------------------------------------------

function ToolbarBtn({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded px-2 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-200 transition-colors"
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Blog Editor Component
// ---------------------------------------------------------------------------

export default function BlogEditor({ token }: { token: string }) {
  const [mode, setMode] = useState<EditorMode>("list");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Editor fields
  const [editSlug, setEditSlug] = useState<string | null>(null); // null = new post
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tagsText, setTagsText] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [content, setContent] = useState("");

  const [tab, setTab] = useState<EditorTab>("write");
  const contentRef = React.useRef<HTMLTextAreaElement>(null);

  const parsedTags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);

  // ─── Fetch all posts ───
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/blog", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Failed to load posts (${resp.status})`);
      const data = await resp.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ─── Open editor for new post ───
  function startNew() {
    setEditSlug(null);
    setTitle("");
    setDescription("");
    setDate(new Date().toISOString().slice(0, 10));
    setTagsText("");
    setCoverImage("");
    setContent("");
    setMessage("");
    setMode("edit");
  }

  // ─── Open editor for existing post ───
  function startEdit(post: BlogPost) {
    setEditSlug(post.slug);
    setTitle(post.title);
    setDescription(post.description);
    setDate(post.date);
    setTagsText(post.tags.join(", "));
    setCoverImage(post.coverImage);
    setContent(post.content);
    setMessage("");
    setMode("edit");
  }

  // ─── Save post ───
  async function handleSave() {
    if (!title.trim()) {
      setMessage("Title is required");
      return;
    }
    if (!content.trim()) {
      setMessage("Content is required");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const resp = await fetch("/api/blog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          date,
          tags,
          coverImage: coverImage.trim() || undefined,
          content: content,
          slug: editSlug || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${resp.status})`);
      }

      setMessage("Post saved!");
      await fetchPosts();
      setMode("list");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete post ───
  async function handleDelete(slug: string) {
    if (!confirm(`Delete "${slug}"? This can't be undone.`)) return;

    setDeleting(slug);
    try {
      const resp = await fetch(`/api/blog?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Delete failed (${resp.status})`);
      await fetchPosts();
      setMessage("Post deleted");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  // ─── Toolbar: insert formatting at cursor ───
  function insertAtCursor(before: string, after: string = "") {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const replacement = before + (selected || "text") + after;
    const newContent = content.slice(0, start) + replacement + content.slice(end);
    setContent(newContent);
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      ta.focus();
      const cursorPos = start + before.length + (selected || "text").length;
      ta.setSelectionRange(cursorPos, cursorPos);
    });
  }

  // ─── List view ───
  if (mode === "list") {
    return (
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Blog Posts</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Create and edit blog articles. Posts are saved as MDX files.
            </p>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
          >
            New Post
          </button>
        </div>

        {message && (
          <p className={`mt-3 text-sm ${message.includes("fail") || message.includes("Failed") ? "text-red-600" : "text-green-700"}`}>
            {message}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-zinc-400">Loading...</p>
        ) : posts.length === 0 ? (
          <div className="mt-8 rounded-xl border-2 border-dashed border-zinc-200 p-10 text-center">
            <p className="text-zinc-400">No blog posts yet</p>
            <button
              type="button"
              onClick={startNew}
              className="mt-3 text-sm font-semibold text-amber-600 hover:text-amber-500"
            >
              Write your first article
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {posts.map((post) => (
              <div
                key={post.slug}
                className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 transition-colors hover:border-zinc-300"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-zinc-900 truncate">{post.title}</h3>
                  <p className="mt-0.5 text-sm text-zinc-500 truncate">{post.description}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
                    <span>{post.date}</span>
                    {post.tags.length > 0 && (
                      <span>{post.tags.join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="ml-4 flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(post)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(post.slug)}
                    disabled={deleting === post.slug}
                    className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {deleting === post.slug ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Full-page preview ───
  if (tab === "preview") {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTab("write")}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              &larr; Back to Editor
            </button>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Preview
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : editSlug ? "Update Post" : "Publish Post"}
            </button>
          </div>
        </div>

        {message && (
          <p className={`mb-4 text-sm ${message.includes("fail") || message.includes("Failed") || message.includes("required") ? "text-red-600" : "text-green-700"}`}>
            {message}
          </p>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white px-6">
          <BlogPreview
            title={title}
            description={description}
            date={date}
            tags={parsedTags}
            coverImage={coverImage}
            content={content}
          />
        </div>
      </div>
    );
  }

  // ─── Editor view ───
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900">
          {editSlug ? "Edit Post" : "New Post"}
        </h2>
        <button
          type="button"
          onClick={() => { setMode("list"); setMessage(""); setTab("write"); }}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${message.includes("fail") || message.includes("Failed") || message.includes("required") ? "text-red-600" : "text-green-700"}`}>
          {message}
        </p>
      )}

      <div className="mt-6 space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-zinc-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Best LEGO Star Wars Sets in 2026"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-zinc-700">
            Description
            <span className="ml-1 font-normal text-zinc-400">(shown in previews & SEO)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Our top picks for the best Star Wars sets available right now."
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Date & Tags row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-zinc-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700">
              Tags
              <span className="ml-1 font-normal text-zinc-400">(comma separated)</span>
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="star-wars, rankings, buying-guide"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Cover Image */}
        <div>
          <label className="block text-sm font-semibold text-zinc-700">
            Cover Image URL
            <span className="ml-1 font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="https://images.example.com/my-cover.jpg"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Content with toolbar */}
        <div>
          <label className="block text-sm font-semibold text-zinc-700">Content</label>

          {/* Formatting toolbar */}
          <div className="mt-1 flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-zinc-200 bg-zinc-50 px-2 py-1.5">
            <ToolbarBtn label="B" onClick={() => insertAtCursor("**", "**")} title="Bold" />
            <ToolbarBtn label="I" onClick={() => insertAtCursor("*", "*")} title="Italic" />
            <span className="mx-1 h-4 w-px bg-zinc-300" />
            <ToolbarBtn label="H2" onClick={() => insertAtCursor("\n## ", "\n")} title="Heading 2" />
            <ToolbarBtn label="H3" onClick={() => insertAtCursor("\n### ", "\n")} title="Heading 3" />
            <span className="mx-1 h-4 w-px bg-zinc-300" />
            <ToolbarBtn label="• List" onClick={() => insertAtCursor("\n- ", "\n")} title="Bullet list" />
            <ToolbarBtn label="1. List" onClick={() => insertAtCursor("\n1. ", "\n")} title="Numbered list" />
            <ToolbarBtn label="Link" onClick={() => insertAtCursor("[", "](url)")} title="Link" />
            <span className="mx-1 h-4 w-px bg-zinc-300" />
            <ToolbarBtn label="Set Link" onClick={() => insertAtCursor('<SetLink setNum="', '">Set Name</SetLink>')} title="Link to a LEGO set" />
            <ToolbarBtn label="Theme Link" onClick={() => insertAtCursor('<ThemeLink slug="', '">Theme Name</ThemeLink>')} title="Link to a theme" />
            <ToolbarBtn label="Tip" onClick={() => insertAtCursor("\n<Callout type=\"tip\">\n", "\n</Callout>\n")} title="Tip callout box" />
            <ToolbarBtn label="CTA" onClick={() => insertAtCursor('<CTA href="', '">Button Text</CTA>')} title="Call-to-action button" />
          </div>

          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            placeholder={`Write your article here using markdown...\n\nYou can use:\n- **Bold** and *italic* text\n- ## Headings\n- Bullet lists and numbered lists\n- [Links](url)\n\nSpecial components (use the toolbar above):\n- <SetLink> to link to a LEGO set\n- <ThemeLink> to link to a theme page\n- <Callout> for tip/info/warning boxes\n- <CTA> for call-to-action buttons`}
            className="w-full rounded-b-lg border border-zinc-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : editSlug ? "Update Post" : "Publish Post"}
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => { setMode("list"); setMessage(""); setTab("write"); }}
            className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
