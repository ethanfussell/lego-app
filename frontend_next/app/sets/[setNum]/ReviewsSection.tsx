// frontend_next/app/sets/[setNum]/ReviewsSection.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { asTrimmedString } from "@/lib/types";
import RatingHistogram from "@/app/components/RatingHistogram";
import { ReviewListSkeleton } from "@/app/components/Skeletons";
import ErrorState from "@/app/components/ErrorState";

export type ReviewItem = {
  id: number;
  set_num: string;
  user: string;
  rating: number | null;
  text: string | null;
  created_at: string;
  updated_at: string | null;
  upvotes: number;
  downvotes: number;
  user_vote: string | null;
};

type ReviewSortKey = "newest" | "oldest" | "highest" | "lowest";

function normalizeUsername(raw: unknown): string | null {
  return asTrimmedString(raw);
}

function formatReviewDate(value?: string | null) {
  const s = asTrimmedString(value);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

type Props = {
  reviews: ReviewItem[];
  reviewsLoading: boolean;
  reviewsError: string | null;
  avgRating: number | null;
  ratingCount: number;
  isLoggedIn: boolean;
  meUsername: string | null;
  token: string | null;
  onVote: (reviewId: number, voteType: "up" | "down") => void;
  onReport: (reviewId: number, reason: string, notes: string) => Promise<void>;
  onStartEdit: () => void;
  onDelete: () => void;
};

export default function ReviewsSection({
  reviews,
  reviewsLoading,
  reviewsError,
  avgRating,
  ratingCount,
  isLoggedIn,
  meUsername,
  token,
  onVote,
  onReport,
  onStartEdit,
  onDelete,
}: Props) {
  const [reviewSort, setReviewSort] = useState<ReviewSortKey>("newest");

  // Report form state
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState<string>("spam");
  const [reportNotes, setReportNotes] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const visibleReviews = useMemo(() => {
    const filtered = reviews.filter((r) => asTrimmedString(r.text));
    return [...filtered].sort((a, b) => {
      switch (reviewSort) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "highest":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "lowest":
          return (a.rating ?? 0) - (b.rating ?? 0);
        default:
          return 0;
      }
    });
  }, [reviews, reviewSort]);

  const ratingHistogram: Record<string, number> | null = useMemo(() => {
    const withRating = reviews.filter((r) => typeof r.rating === "number" && Number.isFinite(r.rating));
    if (withRating.length === 0) return null;
    const bins: Record<string, number> = {};
    for (const r of withRating) {
      const rounded = Math.round((r.rating as number) * 2) / 2;
      bins[rounded.toFixed(1)] = (bins[rounded.toFixed(1)] || 0) + 1;
    }
    return bins;
  }, [reviews]);

  async function handleReportSubmit(reviewId: number) {
    if (!token || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await onReport(reviewId, reportReason, reportNotes.trim());
      setReportingReviewId(null);
      setReportReason("spam");
      setReportNotes("");
    } catch {
      // errors handled by parent callback
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {visibleReviews.length > 1 ? (
          <select
            value={reviewSort}
            onChange={(e) => setReviewSort(e.target.value as ReviewSortKey)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        ) : null}
      </div>

      {ratingHistogram && ratingCount > 0 ? (
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-2 text-center text-sm font-semibold text-zinc-900">
            {avgRating != null ? avgRating.toFixed(1) : "\u2014"} average from {ratingCount} rating{ratingCount === 1 ? "" : "s"}
          </div>
          <RatingHistogram histogram={ratingHistogram} height={100} barWidth={36} gap={8} />
        </div>
      ) : null}

      {reviewsLoading ? <div className="mt-3"><ReviewListSkeleton count={2} /></div> : null}
      {reviewsError ? <ErrorState message={reviewsError} /> : null}

      {!reviewsLoading && !reviewsError && visibleReviews.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
          <svg className="h-10 w-10 text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          <div className="text-base font-semibold text-zinc-600">No reviews yet</div>
          <p className="mt-1 text-sm text-zinc-500">Be the first to share your thoughts on this set</p>
        </div>
      ) : null}

      {!reviewsLoading && !reviewsError && visibleReviews.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {visibleReviews.map((r) => {
            const isMine = isLoggedIn && meUsername && r.user === meUsername;
            const when = formatReviewDate(r.created_at);
            const u = normalizeUsername(r.user);

            return (
              <li
                key={String(r.id)}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-zinc-500">
                    {u ? (
                      <Link
                        href={`/users/${encodeURIComponent(u)}`}
                        className="font-semibold text-zinc-800 hover:underline"
                      >
                        {u}
                      </Link>
                    ) : (
                      <span className="font-semibold text-zinc-800">Unknown</span>
                    )}
                    {when ? <span className="ml-2 font-semibold text-zinc-500">&bull; {when}</span> : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {typeof r.rating === "number" ? (
                      <div className="text-sm font-semibold text-amber-600">{r.rating.toFixed(1)} &#9733;</div>
                    ) : null}

                    {isMine ? (
                      <>
                        <button
                          type="button"
                          onClick={onStartEdit}
                          className="rounded-full border border-zinc-200 bg-transparent px-3 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={onDelete}
                          className="rounded-full border border-red-200 bg-transparent px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {asTrimmedString(r.text) ? <p className="mt-2 text-sm text-zinc-600">{r.text}</p> : null}

                <div className="mt-3 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onVote(r.id, "up")}
                    disabled={!token}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      r.user_vote === "up"
                        ? "font-semibold text-amber-600"
                        : "text-zinc-400 hover:text-zinc-600"
                    } disabled:opacity-40`}
                    title="Helpful"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
                    </svg>
                    {r.upvotes > 0 ? r.upvotes : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => onVote(r.id, "down")}
                    disabled={!token}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      r.user_vote === "down"
                        ? "font-semibold text-red-500"
                        : "text-zinc-400 hover:text-zinc-600"
                    } disabled:opacity-40`}
                    title="Not helpful"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.048.15.62 1.555.903 3.3.903 5.1a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
                    </svg>
                    {r.downvotes > 0 ? r.downvotes : null}
                  </button>

                  {/* Report button — only for other users' reviews */}
                  {token && r.user !== meUsername ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (reportingReviewId === r.id) {
                          setReportingReviewId(null);
                        } else {
                          setReportingReviewId(r.id);
                          setReportReason("spam");
                          setReportNotes("");
                        }
                      }}
                      className="ml-auto flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                      title="Report this review"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                      </svg>
                    </button>
                  ) : null}
                </div>

                {/* Inline report form */}
                {reportingReviewId === r.id ? (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-xs font-semibold text-zinc-700 mb-2">Report this review</p>
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
                          placeholder="Any additional details\u2026"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 placeholder:text-zinc-400"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReportSubmit(r.id)}
                          disabled={reportSubmitting}
                          className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                        >
                          {reportSubmitting ? "Sending\u2026" : "Submit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportingReviewId(null)}
                          className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
