// frontend_next/app/lists/[id]/ListDetailClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";
import AddToListMenu from "@/app/components/AddToListMenu";

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
  const nums = Array.from(
    new Set((setNums || []).map((s) => String(s || "").trim()).filter(Boolean))
  );
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

  const refresh = useCallback(async () => {
    if (!id) throw new Error("Missing list id.");

    // only send token after hydration
    const maybeToken = hydrated ? token : undefined;

    const d = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(id)}`, {
      token: maybeToken,
      cache: "no-store",
    });

    setDetail(d || null);

    const nums = toSetNums(d || null);
    const bulk = await fetchSetsBulk(nums, maybeToken);
    setSets(bulk);
  }, [id, token, hydrated]);

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
  }, [id, refresh]);

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

  const subtitle = useMemo(() => {
    const count =
      typeof detail?.items_count === "number"
        ? detail.items_count
        : Array.isArray(detail?.items)
        ? detail.items.length
        : sets.length;

    const vis =
      typeof detail?.is_public === "boolean"
        ? detail.is_public
          ? "Public"
          : "Private"
        : null;

    const bits: string[] = [];
    if (Number.isFinite(count)) bits.push(`${count} set${count === 1 ? "" : "s"}`);
    if (vis) bits.push(vis);
    if (ownerName) bits.push(`by ${ownerName}`);

    return bits.join(" • ") || "—";
  }, [detail, sets.length, ownerName]);

  const showEmpty = !loading && !err && sets.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {detail?.title || (id ? `List ${id}` : "List")}
          </h1>

          {detail?.description ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{detail.description}</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          )}
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

      {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {showEmpty ? (
        <div className="mt-8 rounded-2xl border border-black/[.08] bg-white p-6 text-sm text-zinc-600 dark:border-white/[.14] dark:bg-zinc-950 dark:text-zinc-400">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">This list is empty</div>
          <div className="mt-2">
            Use <span className="font-semibold">Add to list</span> on any set card to add items here.
          </div>
        </div>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {sets.map((s) => {
            const sn = String(s.set_num);
            const inThisList = setNumSet.has(sn);

            return (
              <li key={sn}>
                <SetCard
                  set={s as any}
                  footer={
                    token ? (
                      <div className="space-y-2">
                        <AddToListMenu token={token} setNum={sn} />
                        {canEdit && inThisList ? (
                          <button
                            type="button"
                            disabled={!!removing[sn]}
                            onClick={() => removeFromThisList(sn)}
                            className="w-full rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
                          >
                            {removing[sn] ? "Removing…" : "Remove from this list"}
                          </button>
                        ) : null}
                      </div>
                    ) : null
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}