// frontend_next/app/lists/[listId]/ListDetailClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, APIError } from "@/lib/api";
import { useAuth } from "@/app/providers";
import { useToast } from "@/app/ui-providers/ToastProvider";
import SetCard from "@/app/components/SetCard";
import SetCardActions from "@/app/components/SetCardActions";
import { useCollectionStatus } from "@/lib/useCollectionStatus";
import type { SetLite } from "@/lib/types";

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

  created_at?: string | null;
  updated_at?: string | null;
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
  const arr = Array.isArray(data)
    ? (data as unknown[]).filter((x): x is SetLite => {
        return typeof x === "object" && x !== null && typeof (x as { set_num?: unknown }).set_num === "string";
      })
    : [];

  const byNum = new Map(arr.map((s) => [String(s.set_num), s]));
  return nums.map((n) => byNum.get(n)).filter((v): v is SetLite => !!v);
}

function chipClass(variant: "neutral" | "good" | "warn") {
  if (variant === "good") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  }
  if (variant === "warn") {
    return "border-amber-500/20 bg-amber-50 text-amber-600";
  }
  return "border-zinc-300 bg-zinc-200 text-zinc-700";
}

export default function ListDetailClient(props: {
  listId: string;
  initialDetail: ListDetail;
  initialSets: SetLite[];
}) {
  const { listId, initialDetail, initialSets } = props;

  const router = useRouter();
  const { token, me, hydrated } = useAuth();
  const { isOwned, isWishlist, getUserRating } = useCollectionStatus();
  const toast = useToast();

  const id = useMemo(() => String(listId || "").trim(), [listId]);

  // ✅ start from SSR content
  const [detail, setDetail] = useState<ListDetail | null>(initialDetail || null);
  const [sets, setSets] = useState<SetLite[]>(Array.isArray(initialSets) ? initialSets : []);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});

  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [copyErr, setCopyErr] = useState<string | null>(null);

  // Report list
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportNotes, setReportNotes] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

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
    const nums = toSetNums(detail);
    return nums.length || sets.length;
  }, [detail, sets.length]);

  const visibility = useMemo(() => {
    if (typeof detail?.is_public !== "boolean") return null;
    return detail.is_public ? "Public" : "Private";
  }, [detail?.is_public]);

  const isPublic = !!detail?.is_public;

  const refresh = useCallback(async () => {
    if (!id) throw new Error("Missing list id.");

    // ✅ do NOT clear SSR content while loading
    try {
      const d = await apiFetch<ListDetail>(`/lists/${encodeURIComponent(id)}`, { token, cache: "no-store" });
      if (d) setDetail(d);

      const nums = toSetNums(d || null);
      if (nums.length) {
        const bulk = await fetchSetsBulk(nums, token);
        // ✅ only replace sets if we got results; otherwise keep SSR sets
        if (bulk.length) setSets(bulk);
      }
    } catch (e: unknown) {
      if (e instanceof APIError) {
        // don’t nuke SSR; just show error
        if (e.status === 404) throw new Error("List not found.");
        if (e.status === 401 || e.status === 403) throw new Error("This list is private.");
      }
      throw e;
    }
  }, [id, token]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hydrated) return;
      if (!id) return;

      // only refresh if logged in (so we can show edit controls etc)
      if (!token) return;

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
  }, [hydrated, id, token, refresh]);

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
      // try to re-sync, but don’t break page if it fails
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

  async function handleReportList() {
    if (!token || !detail || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await apiFetch("/reports", {
        method: "POST",
        token,
        body: {
          target_type: "list",
          target_id: Number(detail.id),
          reason: reportReason,
          notes: reportNotes.trim() || null,
        },
      });
      toast.push("Report submitted", { type: "success" });
      setShowReportForm(false);
      setReportReason("spam");
      setReportNotes("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("409") || msg.includes("already_reported")) {
        toast.push("You've already reported this list", { type: "error" });
        setShowReportForm(false);
      } else if (msg.includes("cannot_report_own")) {
        toast.push("You can't report your own list", { type: "error" });
        setShowReportForm(false);
      } else {
        toast.push(msg || "Failed to submit report", { type: "error" });
      }
    } finally {
      setReportSubmitting(false);
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

  const description = detail?.description?.trim() || "";

  const headerSubtitle = useMemo(() => {
    const bits: string[] = [];
    bits.push(`${count} set${count === 1 ? "" : "s"}`);
    if (ownerName) bits.push(`by ${ownerName}`);
    return bits.join(" • ");
  }, [count, ownerName]);

  // Avoid `as any` for SetCard props
  type SetCardSetProp = React.ComponentProps<typeof SetCard>["set"];

  return (
    <div className="mt-10">
      {/* This component should NOT duplicate the SSR set grid.
          It’s just controls + enhancements. */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-500">
          {headerSubtitle}
          {visibility ? (
            <span
              className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${chipClass(
                visibility === "Public" ? "good" : "warn"
              )}`}
            >
              {visibility}
            </span>
          ) : null}
          {isSystem ? (
            <span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${chipClass("neutral")}`}>
              System
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isPublic ? (
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              title="Copy shareable link"
            >
              {copyState === "copied" ? "Copied!" : "Copy link"}
            </button>
          ) : null}

          {!token ? (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Log in to edit
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              onClick={togglePublic}
              disabled={savingPrivacy}
              className="rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
              title="Toggle visibility"
            >
              {detail?.is_public ? "Make Private" : "Make Public"}
            </button>
          ) : null}

          {/* Report list — only for logged-in non-owners */}
          {token && !canEdit && isPublic ? (
            <button
              type="button"
              onClick={() => setShowReportForm((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-zinc-200 bg-transparent px-3 py-2 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              title="Report this list"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
              Report
            </button>
          ) : null}
        </div>
      </div>

      {/* Inline report form */}
      {showReportForm ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-semibold text-zinc-700 mb-2">Report this list</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-zinc-500 mb-1">Reason</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700"
              >
                <option value="spam">Spam</option>
                <option value="offensive">Offensive</option>
                <option value="inappropriate">Inappropriate</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex-[2] min-w-[160px]">
              <label className="block text-xs text-zinc-500 mb-1">Notes (optional)</label>
              <input
                type="text"
                maxLength={200}
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Any additional details…"
                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 placeholder:text-zinc-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReportList}
                disabled={reportSubmitting}
                className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {reportSubmitting ? "Sending…" : "Submit"}
              </button>
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {description ? <p className="mt-3 max-w-2xl text-sm text-zinc-500">{description}</p> : null}

      {copyErr ? <p className="mt-4 text-sm text-red-600">Error: {copyErr}</p> : null}
      {loading ? <p className="mt-4 text-sm text-zinc-500">Refreshing…</p> : null}
      {err ? <p className="mt-4 text-sm text-red-600">Error: {err}</p> : null}

      {/* Optional: editor-only “remove” actions on the SSR sets */}
      {canEdit && sets.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900">Manage items</h2>
          <ul className="mt-4 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
            {sets.map((s) => {
              const sn = String(s.set_num);
              const isRemoving = !!removing[sn];

              return (
                <li key={sn} className={isRemoving ? "opacity-60" : ""}>
                  <SetCard
                    set={s as unknown as SetCardSetProp}
                    token={token ?? undefined}
                    isOwnedByUser={isOwned(sn)}
                    userRatingOverride={getUserRating(sn)}
                    footer={
                      <div className="space-y-2">
                        {token ? <SetCardActions token={token} setNum={sn} isOwned={isOwned(sn)} isWishlist={isWishlist(sn)} /> : null}

                        <button
                          type="button"
                          onClick={() => removeFromThisList(sn)}
                          disabled={isRemoving}
                          className="inline-flex w-full items-center justify-center rounded-full border border-red-200 bg-transparent px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          {isRemoving ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}