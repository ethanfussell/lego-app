// frontend_next/app/lists/[id]/ListDetailClient.tsx
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

  const data = await apiFetch<SetLite[]>(`/sets/bulk?${params.toString()}`, {
    token,
    cache: "no-store",
  });

  const arr = Array.isArray(data) ? data : [];
  const byNum = new Map(arr.map((s) => [String(s.set_num), s]));
  return nums.map((n) => byNum.get(n)).filter(Boolean) as SetLite[];
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

  const setNums = useMemo(() => toSetNums(detail), [detail]);
  const setNumSet = useMemo(() => new Set(setNums.map(String)), [setNums]);

  const ownerName = useMemo(() => {
    const d: any = detail || {};
    return String(d.owner_username || d.owner || d.username || "").trim();
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

  const refresh = useCallback(async () => {
    if (!id) throw new Error("Missing list id.");

    setNotFound(false);
    setForbidden(false);

    // ✅ IMPORTANT: always use the real token (after hydration gate below)
    try {
      const d = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(id)}`, {
        token,
        cache: "no-store",
      });

      setDetail(d || null);

      const nums = toSetNums(d || null);
      const bulk = await fetchSetsBulk(nums, token);
      setSets(bulk);
    } catch (e: any) {
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

      // ✅ IMPORTANT: wait for auth to hydrate (localStorage token loaded)
      if (!hydrated) return;

      try {
        if (!cancelled) {
          setLoading(true);
          setErr(null);
        }
        await refresh();
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
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

    // optimistic
    setDetail((d) => (d ? { ...d, is_public: next } : d));

    try {
      await apiFetch(`/lists/${encodeURIComponent(id)}`, {
        token,
        method: "PATCH",
        body: { is_public: next },
      });
    } catch (e: any) {
      // rollback
      setDetail((d) => (d ? { ...d, is_public: !next } : d));
      setErr(e?.message || String(e));
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function removeFromThisList(setNum: string) {
    const sn = String(setNum || "").trim();
    if (!sn || !token || !canEdit || removing[sn]) return;

    setErr(null);
    setRemoving((m) => ({ ...m, [sn]: true }));

    // optimistic UI
    setSets((prev) => prev.filter((s) => String(s.set_num) !== sn));
    setDetail((d) =>
      d ? { ...d, items_count: Math.max(0, Number(d.items_count || 0) - 1) } : d
    );

    try {
      await apiFetch(`/lists/${encodeURIComponent(id)}/items/${encodeURIComponent(sn)}`, {
        token,
        method: "DELETE",
      });
    } catch (e: any) {
      setErr(e?.message || String(e));
      // safest: refresh truth
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

  const title = detail?.title?.trim() || (id ? `List ${id}` : "List");
  const description = detail?.description?.trim() || "";

  const headerSubtitle = useMemo(() => {
    const bits: string[] = [];
    bits.push(`${count} set${count === 1 ? "" : "s"}`);
    if (ownerName) bits.push(`by ${ownerName}`);
    return bits.join(" • ");
  }, [count, ownerName]);

  const showGrid = !loading && !err && !notFound && !forbidden && sets.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Header */}
      <div className="pt-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>

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

          {description ? (
            <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/collection"
            className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            Back
          </Link>

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

      {/* States */}
      {loading ? <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">Loading…</p> : null}
      {err ? <p className="mt-8 text-sm text-red-600">Error: {err}</p> : null}

      {!loading && !err && notFound ? (
        <div className="mt-10 rounded-2xl border border-black/[.08] bg-white p-6 text-sm dark:border-white/[.14] dark:bg-zinc-950">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">List not found</div>
          <div className="mt-2 text-zinc-600 dark:text-zinc-400">
            It may have been deleted, or the link is wrong.
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

      {/* Grid */}
      {showGrid ? (
        <ul className="mt-8 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {sets.map((s) => {
            const sn = String(s.set_num);

            return (
              <li key={sn}>
                <SetCard
                  set={s as any}
                  footer={token ? <SetCardActions token={token} setNum={sn} /> : null}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}