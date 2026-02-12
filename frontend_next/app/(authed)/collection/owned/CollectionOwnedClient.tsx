// frontend_next/app/(authed)/collection/owned/CollectionOwnedClient.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/providers";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";

type ListSummary = {
  id: number | string;
  title?: string;
  is_public?: boolean;
  is_system?: boolean;
  system_key?: string | null;
  items_count?: number;
};

type ListDetail = ListSummary & {
  items?: Array<{ set_num: string; added_at?: string; position?: number }>;
};

type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  num_parts?: number;
  image_url?: string | null;
  theme?: string;
};

function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error ? e.message : String(e ?? fallback);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toSetNums(detail: ListDetail | null | undefined): string[] {
  const items = Array.isArray(detail?.items) ? detail.items : [];
  return items.map((x) => String(x.set_num ?? "").trim()).filter(Boolean);
}

function toPlain(n: string): string {
  return n.replace(/-\d+$/, "");
}

function toDash1(n: string): string {
  return /-\d+$/.test(n) ? n : `${n}-1`;
}

function asSetLiteArray(v: unknown): SetLite[] {
  if (!Array.isArray(v)) return [];
  const out: SetLite[] = [];

  for (const raw of v) {
    if (!isRecord(raw)) continue;

    const set_num = typeof raw.set_num === "string" ? raw.set_num.trim() : "";
    if (!set_num) continue;

    const maybeName = raw.name;
    const maybeYear = raw.year;
    const maybeParts = raw.num_parts;
    const maybeTheme = raw.theme;

    // IMPORTANT: with exactOptionalPropertyTypes, do not assign undefined; omit instead
    out.push({
      set_num,
      ...(typeof maybeName === "string" ? { name: maybeName } : {}),
      ...(typeof maybeYear === "number" ? { year: maybeYear } : {}),
      ...(typeof maybeParts === "number" ? { num_parts: maybeParts } : {}),
      image_url: typeof raw.image_url === "string" ? raw.image_url : null,
      ...(typeof maybeTheme === "string" ? { theme: maybeTheme } : {}),
    });
  }

  return out;
}

async function fetchSetsBulk(setNums: string[], token: string): Promise<SetLite[]> {
  const nums = setNums.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (nums.length === 0) return [];

  const params = new URLSearchParams();
  params.set("set_nums", nums.join(","));

  const data = await apiFetch<unknown>(`/sets/bulk?${params.toString()}`, {
    token,
    cache: "no-store",
  });

  const arr = asSetLiteArray(data);
  if (arr.length === 0) return [];

  const byKey = new Map<string, SetLite>();
  for (const s of arr) {
    const sn = s.set_num.trim();
    if (!sn) continue;
    byKey.set(sn, s);
    byKey.set(toPlain(sn), s);
    byKey.set(toDash1(sn), s);
  }

  return nums
    .map((n) => byKey.get(n) || byKey.get(toPlain(n)) || byKey.get(toDash1(n)))
    .filter((x): x is SetLite => Boolean(x));
}

export default function CollectionOwnedClient() {
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [ownedDetail, setOwnedDetail] = useState<ListDetail | null>(null);
  const [sets, setSets] = useState<SetLite[]>([]);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    if (!token) return;

    const mine = await apiFetch<ListSummary[]>("/lists/me", { token, cache: "no-store" });
    const arr = Array.isArray(mine) ? mine : [];
    const owned = arr.find((l) => String(l.system_key ?? "").toLowerCase() === "owned");

    if (!owned) {
      setOwnedDetail(null);
      setSets([]);
      return;
    }

    const detail = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(String(owned.id))}`, {
      token,
      cache: "no-store",
    });

    setOwnedDetail(detail ?? null);

    const nums = toSetNums(detail);
    const bulk = await fetchSetsBulk(nums, token);
    setSets(bulk);
  }, [token]);

  const removeOwned = useCallback(
    async (setNum: string) => {
      if (!token) return;

      const plain = toPlain(String(setNum || "").trim());
      if (!plain) return;

      try {
        setErr(null);
        setRemoving((m) => ({ ...m, [plain]: true }));

        // optimistic
        setSets((prev) => prev.filter((s) => toPlain(s.set_num) !== plain));

        await apiFetch(`/collections/owned/${encodeURIComponent(plain)}`, {
          token,
          method: "DELETE",
        });

        await refresh();
      } catch (e: unknown) {
        setErr(errorMessage(e, "Failed to remove from owned"));
        await refresh();
      } finally {
        setRemoving((m) => {
          const next = { ...m };
          delete next[plain];
          return next;
        });
      }
    },
    [token, refresh]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        setLoading(true);
        setErr(null);
        await refresh();
      } catch (e: unknown) {
        if (!cancelled) setErr(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router, refresh]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="pt-10 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owned</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {ownedDetail?.items_count ? `${ownedDetail.items_count} sets` : "Your owned LEGO sets."}
          </p>
        </div>

        <Link
          href="/collection"
          className="rounded-full border border-black/[.10] bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
        >
          Back
        </Link>
      </div>

      {loading ? <p className="mt-6 text-sm">Loading…</p> : null}
      {err ? <p className="mt-6 text-sm text-red-600">Error: {err}</p> : null}

      {sets.length === 0 && !loading ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No sets yet.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 list-none p-0">
          {sets.map((s) => {
            const plain = toPlain(s.set_num);
            return (
              <li key={s.set_num} className="space-y-2">
                <SetCard
                  set={s}
                  variant="owned"
                  footer={token ? <SetCardActions token={token} setNum={s.set_num} /> : null}
                />
                <button
                  type="button"
                  onClick={() => void removeOwned(s.set_num)}
                  disabled={!!removing[plain]}
                  className="w-full rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/20"
                >
                  {removing[plain] ? "Removing…" : "Remove from owned"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}