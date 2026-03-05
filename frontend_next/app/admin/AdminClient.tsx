"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import RequireAuth from "@/app/components/RequireAuth";

type AdminStats = {
  set_count: number;
  user_count: number;
  email_signup_count: number;
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
      <div className="text-xs font-extrabold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold leading-none text-zinc-900 dark:text-zinc-50">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

export default function AdminClient() {
  const { token, hydrated } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState("");

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
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {error}
            </p>
          </div>
        ) : stats ? (
          <>
            {/* Stats cards */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <StatCard label="Total Sets" value={stats.set_count} />
              <StatCard label="Users" value={stats.user_count} />
              <StatCard label="Email Signups" value={stats.email_signup_count} />
            </div>

            {/* Actions */}
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
                  className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {refreshing ? "Working..." : "Refresh Sets from Rebrickable"}
                </button>

                <button
                  type="button"
                  onClick={handleSync}
                  disabled={refreshing}
                  className="rounded-full border border-black/[.10] bg-white px-5 py-2.5 text-sm font-semibold hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
                >
                  {refreshing ? "Working..." : "Sync Cache to DB"}
                </button>
              </div>

              {refreshResult && (
                <p
                  className={`mt-3 text-sm ${
                    refreshResult.includes("failed")
                      ? "text-red-600"
                      : "text-green-700 dark:text-green-400"
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
