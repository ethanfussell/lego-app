// frontend_next/app/lists/[listId]/ListDetailClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, APIError } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";

type ListDetail = {
  id: number | string;
  title?: string | null;
  description?: string | null;
  is_public?: boolean | null;
  is_system?: boolean | null;
  system_key?: string | null;
  items_count?: number | null;

  owner?: string | null;
  owner_username?: string | null;
  username?: string | null;

  items?: Array<{ set_num: string; added_at?: string; position?: number }> | null;
  set_nums?: string[] | null;
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  pieces?: number;
  num_parts?: number;
  image_url?: string | null;
  theme?: string;
};

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function toSetNums(detail: ListDetail | null | undefined): string[] {
  if (!detail) return [];
  if (Array.isArray(detail.set_nums)) {
    return detail.set_nums.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (Array.isArray(detail.items)) {
    return detail.items.map((it) => String(it?.set_num || "").trim()).filter(Boolean);
  }
  return [];
}

async function fetchSetsBulk(setNums: string[], token?: string): Promise<SetLite[]> {
  const nums = Array.from(new Set((setNums || []).map((s) => String(s || "").trim()).filter(Boolean)));
  if (nums.length === 0) return [];

  const params = new URLSearchParams();
  params.set("set_nums", nums.join(","));

  const data = await apiFetch<unknown>(`/sets/bulk?${params.toString()}`, { token, cache: "no-store" });
  const arr = Array.isArray(data) ? (data as unknown[]).filter((x): x is SetLite => {
    return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
  }) : [];

  const byNum = new Map(arr.map((s) => [String(s.set_num), s]));
  return nums.map((n) => byNum.get(n)).filter((v): v is SetLite => !!v);
}

function chipClass(variant: "neutral" | "good" | "warn") {
  if (variant === "good") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (variant === "warn") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-black/[.10] bg-black/[.04] text-zinc-700 dark:border-white/[.14] dark:bg-white/[.06] dark:text-zinc-200";
}

export default function ListDetailClient({ listId }: { listId: string }) {
  const router = useRouter();
  const { token, me, hydrated } = useAuth();

  const id = useMemo(() => String(listId || "").trim(), [listId]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [detail, setDetail] = useState<ListDetail | null>(null);
  const [sets, setSets] = useState<SetLite[]>([]);

  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});

  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [copyErr, setCopyErr] = useState<string | null>(null);

  const ownerName = useMemo(() => {
    if (!detail) return "";
    return String(detail.owner_username || detail.owner || detail.username || "").trim();
  }, [detail]);

  const isSystem = !!detail?.is_system || !!String(detail?.system_key || "").trim();

  const canEdit = useMemo(() => {
    if (!token) return false;
    if (!me?.username) return false;
    if (!ownerName) return false;
    if (isSystem) return false;
    return ownerName.toLowerCase() === me.username.toLowerCase();
  }, [token, me?.username, ownerName, isSystem]);

  const count = useMemo(() => {
    if (typeof detail?.items_count === "number") return detail.items_count;
    if (Array.isArray(detail?.items)) return detail.items.length;
    return sets.length;
  }, [detail, sets.length]);

  const visibility = useMemo(() => {
    if (typeof detail?.is_public !== "boolean") return null;
    return detail.is_public ? "Public" : "Private";
  }, [detail?.is_public]);

  const isPublic = !!detail?.is_public;

  const refresh = useCallback(async () => {
    if (!id) throw new Error("Missing list id.");

    setNotFound(false);
    setForbidden(false);

    try {
      const d = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(id)}`, { token, cache: "no-store" });
      setDetail(d || null);

      const nums = toSetNums(d || null);
      const bulk = await fetchSetsBulk(nums, token);
      setSets(bulk);
    } catch (e: unknown) {
      if (e instanceof APIError) {
        if (e.status === 404) {
          setNotFound(true);
          setDetail(null);
          setSets([]);
          return;
        }
        if (e.status === 401 || e.status === 403) {
          setForbidden(true);
          setDetail(null);
          setSets([]);
          return;
        }
      }
      throw e;
    }
  }, [id, token]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        if (!cancelled) {
          setErr("Could not read list id from route.");
          setLoading(false);
        }
        return;
      }

      if (!hydrated) return;

      try {
        if (!cancelled) {
          setLoading(true);
          setErr(null);
        }
        await refresh();
      } catch (e: unknown) {
        if (!cancelled) setErr(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, refresh, hydrated]);

  async function togglePublic() {
    if (!detail || !canEdit || savingPrivacy) return;

    const next = !detail.is_public;
    setSavingPrivacy(true);
    setErr(null);

    setDetail((d) => (d ? { ...d, is_public: next } : d));

    try {
      await apiFetch(`/lists/${encodeURIComponent(id)}`, { token, method: "PATCH", body: { is_public: next } });
    } catch (e: unknown) {
      setDetail((d) => (d ? { ...d, is_public: !next } : d));
      setErr(errorMessage(e));
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function removeFromThisList(setNum: string) {
    const sn = String(setNum || "").trim();
    if (!sn || !token || !canEdit || removing[sn]) return;

    setErr(null);
    setRemoving((m) => ({ ...m, [sn]: true }));

    setSets((prev) => prev.filter((s) => String(s.set_num) !== sn));
    setDetail((d) => (d ? { ...d, items_count: Math.max(0, Number(d.items_count || 0) - 1) } : d));

    try {
      await apiFetch(`/lists/${encodeURIComponent(id)}/items/${encodeURIComponent(sn)}`, { token, method: "DELETE" });
    } catch (e: unknown) {
      setErr(errorMessage(e));
      try {
        await refresh();
      } catch {
        // ignore
      }
    } finally {
      setRemoving((m) => {
        const next = { ...m };
        delete next[sn];
        return next;
      });
    }
  }

  async function copyLink() {
    setCopyErr(null);
    if (typeof window === "undefined") return;

    const url = window.location.href;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ok = window.prompt("Copy this link:", url);
        if (ok === null) return;
      }

      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch (e: unknown) {
      try {
        window.prompt("Copy this link:", url);
      } catch {
        // ignore
      }
      setCopyErr(errorMessage(e) || "Could not copy link.");
    }
  }

  const title = detail?.title?.trim() || "Private";
  const description = detail?.description?.trim() || "";

  const headerSubtitle = useMemo(() => {
    const bits: string[] = [];
    bits.push(`${count} set${count === 1 ? "" : "s"}`);
    if (ownerName) bits.push(`by ${ownerName}`);
    return bits.join(" • ");
  }, [count, ownerName]);

  const showGrid = !loading && !err && !notFound && !forbidden && sets.length > 0;

  // Avoid `as any` for SetCard props
  type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="flex items-start justify-between gap-4 pt-10">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{headerSubtitle}</span>

            {visibility ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${chipClass(
                  visibility === "Public" ? "good" : "warn"
                )}`}
              >
                {visibility}
              </span>
            ) : null}

            {isSystem ? (
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${chipClass("neutral")}`}>
                System
              </span>
            ) : null}
          </div>

          {description ? <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/collection"
            className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            Back
          </Link>

          {isPublic ? (
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              title="Copy shareable link"
            >
              {copyState === "copied" ? "Copied!" : "Copy link"}
            </button>
          ) : null}

          {!token ? (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Log in
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              onClick={togglePublic}
              disabled={savingPrivacy}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              title="Toggle visibility"
            >
              {detail?.is_public ? "Make Private" : "Make Public"}
            </button>
          ) : null}
        </div>
      </div>

      {copyErr ? <p className="mt-4 text-sm text-red-600">Error: {copyErr}</p> : null}

      {loading ? <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">Loading…</p> : null}
      {err ? <p className="mt-8 text-sm text-red-600">Error: {err}</p> : null}

      {!loading && !err && notFound ? (
        <div className="mt-10 rounded-2xl border border-black/[.08] bg-white p-6 text-sm dark:border-white/[.14] dark:bg-zinc-950">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">{token ? "List not found" : "This list may be private"}</div>
          <div className="mt-2 text-zinc-600 dark:text-zinc-400">
            {token
              ? "It may have been deleted, the link is wrong, or you don’t have access."
              : "If someone shared this link with you, you may need to log in to view it. Otherwise it may have been deleted or the link is wrong."}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {!token ? (
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Log in
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Back
            </button>

            <Link
              href="/discover"
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Browse sets
            </Link>

            <button
              type="button"
              onClick={() => refresh()}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !err && forbidden ? (
        <div className="mt-10 rounded-2xl border border-black/[.08] bg-white p-6 text-sm dark:border-white/[.14] dark:bg-zinc-950">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">This list is private</div>
          <div className="mt-2 text-zinc-600 dark:text-zinc-400">If you have access, log in and try again.</div>
          <div className="mt-4 flex gap-2">
            {!token ? (
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
              >
                Log in
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => refresh()}
              className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !err && !notFound && !forbidden && sets.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-black/[.08] bg-white p-6 text-sm dark:border-white/[.14] dark:bg-zinc-950">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">This list is empty</div>
          <div className="mt-2 text-zinc-600 dark:text-zinc-400">
            Use <span className="font-semibold">Add to list</span> on any set card to add items here.
          </div>
          <div className="mt-4">
            <Link
              href="/discover"
              className="inline-flex rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
            >
              Browse sets
            </Link>
          </div>
        </div>
      ) : null}

      {showGrid ? (
        <ul className="mt-8 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {sets.map((s) => {
            const sn = String(s.set_num);
            const isRemoving = !!removing[sn];

            return (
              <li key={sn} className={isRemoving ? "opacity-60" : ""}>
                <SetCard
                  set={s as unknown as SetCardSetProp}
                  footer={
                    <div className="space-y-2">
                      {token ? <SetCardActions token={token} setNum={sn} /> : null}

                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => removeFromThisList(sn)}
                          disabled={isRemoving}
                          className="inline-flex w-full items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/20"
                        >
                          {isRemoving ? "Removing…" : "Remove"}
                        </button>
                      ) : null}
                    </div>
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}