"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/app/ui-providers/ToastProvider";
import RequireAuth from "@/app/components/RequireAuth";

type AdminStats = {
  set_count: number;
  user_count: number;
  email_signup_count: number;
  review_count: number;
  affiliate_click_count: number;
};

type ReportItem = {
  id: number;
  reporter: string;
  target_type: "review" | "list";
  target_id: number;
  target_snippet: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-extrabold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold leading-none text-zinc-900">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function ReasonBadge({ reason }: { reason: string }) {
  const colors: Record<string, string> = {
    spam: "border-amber-200 bg-amber-50 text-amber-700",
    offensive: "border-red-200 bg-red-50 text-red-700",
    inappropriate: "border-orange-200 bg-orange-50 text-orange-700",
    other: "border-zinc-200 bg-zinc-100 text-zinc-600",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${colors[reason] || colors.other}`}>
      {reason}
    </span>
  );
}

export default function AdminClient() {
  const { token, hydrated } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState("");

  // Reports
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [actioningId, setActioningId] = useState<number | null>(null);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setReportsLoading(true);
    setReportsError("");
    try {
      const data = await apiFetch<ReportItem[]>("/admin/reports?report_status=pending&limit=50", { token });
      setReports(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("403")) setReportsError(msg);
    } finally {
      setReportsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!hydrated || !token) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<AdminStats>("/admin/stats", { token });
        if (!cancelled) setStats(data);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(
            msg.includes("403")
              ? "You do not have admin access."
              : `Error loading stats: ${msg}`
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, token]);

  // Fetch reports after stats load (i.e., we know we're admin)
  useEffect(() => {
    if (stats && token) fetchReports();
  }, [stats, token, fetchReports]);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshResult("");
    try {
      const data = await apiFetch<{
        ok: boolean;
        total?: number;
        inserted?: number;
        updated?: number;
      }>("/admin/sets/refresh", { method: "POST", token });
      setRefreshResult(
        `Refreshed: ${data.total ?? 0} total, ${data.inserted ?? 0} new, ${data.updated ?? 0} updated`
      );
      // Re-fetch stats
      const fresh = await apiFetch<AdminStats>("/admin/stats", { token });
      setStats(fresh);
    } catch (e: unknown) {
      setRefreshResult(
        `Refresh failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSync() {
    setRefreshing(true);
    setRefreshResult("");
    try {
      const data = await apiFetch<{
        ok: boolean;
        total?: number;
        inserted?: number;
        updated?: number;
      }>("/admin/sets/sync", { method: "POST", token });
      setRefreshResult(
        `Synced: ${data.total ?? 0} total, ${data.inserted ?? 0} new, ${data.updated ?? 0} updated`
      );
      const fresh = await apiFetch<AdminStats>("/admin/stats", { token });
      setStats(fresh);
    } catch (e: unknown) {
      setRefreshResult(
        `Sync failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleReportAction(reportId: number, action: "resolved" | "dismissed") {
    if (actioningId !== null) return;
    setActioningId(reportId);
    try {
      await apiFetch(`/admin/reports/${reportId}`, {
        method: "PATCH",
        token,
        body: { status: action },
      });
      toast.push(`Report ${action}`, { type: "success" });
      // Remove from list
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Action failed", { type: "error" });
    } finally {
      setActioningId(null);
    }
  }

  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="mt-10 text-2xl font-semibold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your BrickTrack data and view platform stats.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-500">Loading stats...</p>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </div>
        ) : stats ? (
          <>
            {/* Stats cards */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Total Sets" value={stats.set_count} />
              <StatCard label="Users" value={stats.user_count} />
              <StatCard label="Email Signups" value={stats.email_signup_count} />
              <StatCard label="Reviews" value={stats.review_count} />
              <StatCard label="Affiliate Clicks" value={stats.affiliate_click_count} />
            </div>

            {/* Content Moderation */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold">Content Moderation</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Review and manage user-submitted reports.
              </p>

              {reportsLoading ? (
                <p className="mt-4 text-sm text-zinc-500">Loading reports…</p>
              ) : reportsError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">{reportsError}</p>
                  <button
                    type="button"
                    onClick={() => void fetchReports()}
                    className="mt-2 text-sm font-semibold text-red-700 underline"
                  >
                    Retry
                  </button>
                </div>
              ) : reports.length === 0 ? (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
                  <p className="text-sm text-zinc-500">No pending reports</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {reports.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold uppercase text-zinc-400">
                              {r.target_type}
                            </span>
                            <ReasonBadge reason={r.reason} />
                            <span className="text-xs text-zinc-400">
                              by {r.reporter}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-zinc-700 truncate">
                            {r.target_snippet || "[content deleted]"}
                          </p>
                          {r.notes ? (
                            <p className="mt-1 text-xs text-zinc-500 italic">
                              &ldquo;{r.notes}&rdquo;
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-zinc-400">
                            {new Date(r.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReportAction(r.id, "resolved")}
                            disabled={actioningId !== null}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReportAction(r.id, "dismissed")}
                            disabled={actioningId !== null}
                            className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Data Management */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold">Data Management</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Refresh sets from Rebrickable or sync the local cache to the
                database.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  {refreshing ? "Working..." : "Refresh Sets from Rebrickable"}
                </button>

                <button
                  type="button"
                  onClick={handleSync}
                  disabled={refreshing}
                  className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50"
                >
                  {refreshing ? "Working..." : "Sync Cache to DB"}
                </button>
              </div>

              {refreshResult && (
                <p
                  className={`mt-3 text-sm ${
                    refreshResult.includes("failed")
                      ? "text-red-600"
                      : "text-green-700"
                  }`}
                >
                  {refreshResult}
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </RequireAuth>
  );
}
